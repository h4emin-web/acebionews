import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchRecentContext(supabase: any) {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const since = threeDaysAgo.toISOString().split("T")[0];

  const [newsRes, regRes, dealsRes, clinicalRes] = await Promise.all([
    supabase
      .from("news_articles")
      .select("title, summary, source, region, category, date, api_keywords")
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(30),
    supabase
      .from("regulatory_notices")
      .select("title, source, type, date, related_apis")
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(10),
    supabase
      .from("biotech_deals")
      .select("payer, payee, technology, indication, total_m, date, deal_type")
      .gte("date", since)
      .order("date", { ascending: false })
      .limit(10),
    supabase
      .from("clinical_trial_approvals")
      .select("product_name, sponsor, phase, trial_title, approval_date")
      .gte("approval_date", since)
      .order("approval_date", { ascending: false })
      .limit(10),
  ]);

  const sections: string[] = [];

  if (newsRes.data?.length) {
    sections.push("## 최근 뉴스 (DB)\n" + newsRes.data.map((n: any) =>
      `- [${n.date}][${n.region}/${n.source}] ${n.title}: ${n.summary?.slice(0, 120)}${n.api_keywords?.length ? ` (관련 API: ${n.api_keywords.join(", ")})` : ""}`
    ).join("\n"));
  }

  if (regRes.data?.length) {
    sections.push("## 최근 규제/공고 (DB)\n" + regRes.data.map((r: any) =>
      `- [${r.date}][${r.source}] ${r.title} (${r.type})${r.related_apis?.length ? ` - 관련 API: ${r.related_apis.join(", ")}` : ""}`
    ).join("\n"));
  }

  if (dealsRes.data?.length) {
    sections.push("## 최근 바이오 딜 (DB)\n" + dealsRes.data.map((d: any) =>
      `- [${d.date}] ${d.payer} → ${d.payee}: ${d.technology} (${d.indication}, $${d.total_m}M, ${d.deal_type})`
    ).join("\n"));
  }

  if (clinicalRes.data?.length) {
    sections.push("## 최근 임상시험 승인 (DB)\n" + clinicalRes.data.map((c: any) =>
      `- [${c.approval_date}] ${c.product_name} (${c.sponsor}) - ${c.phase}: ${c.trial_title}`
    ).join("\n"));
  }

  return sections.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const context = await fetchRecentContext(supabase);
    const today = new Date().toISOString().split("T")[0];

    const SYSTEM_PROMPT = `당신은 제약·바이오 업계 전문 AI 어시스턴트입니다.
Google 검색을 통해 실시간으로 최신 정보를 찾아서 답변하세요.

답변 규칙:
- 존댓말로 자연스럽게 대화하세요.
- 핵심만 간결하게 답변하고, 사용자가 더 물어보면 자세히 설명하세요.
- 사실 기반으로만 답변하고, 불확실한 내용은 반드시 "확실하지 않습니다" 또는 "확인이 필요합니다"라고 말하세요.
- 추측이나 상상으로 내용을 만들어내지 마세요.
- 출처가 있는 경우 간략히 언급해주세요.
- 한국어로 답변하되, 약물명은 영문 병기 가능합니다.
- 오늘 날짜: ${today}

아래는 자체 DB의 최근 3일 업계 데이터입니다. 관련 내용이 있으면 활용하세요:
${context || "(최근 데이터 없음)"}`;

    // Convert to Gemini contents format
    const geminiContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: geminiContents,
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      if (geminiRes.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI 서비스 오류" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gemini SSE → OpenAI-compatible SSE 변환 (프론트엔드 변경 불필요)
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    (async () => {
      const reader = geminiRes.body!.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json || json === "[DONE]") continue;

            try {
              const parsed = JSON.parse(json);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
                await writer.write(encoder.encode(`data: ${chunk}\n\n`));
              }
            } catch {
              // skip malformed chunk
            }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pharma-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
