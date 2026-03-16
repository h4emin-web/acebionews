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
    sections.push("## 최근 뉴스\n" + newsRes.data.map((n: any) =>
      `- [${n.date}][${n.region}/${n.source}] ${n.title}: ${n.summary?.slice(0, 120)}${n.api_keywords?.length ? ` (관련 API: ${n.api_keywords.join(", ")})` : ""}`
    ).join("\n"));
  }

  if (regRes.data?.length) {
    sections.push("## 최근 규제/공고\n" + regRes.data.map((r: any) =>
      `- [${r.date}][${r.source}] ${r.title} (${r.type})${r.related_apis?.length ? ` - 관련 API: ${r.related_apis.join(", ")}` : ""}`
    ).join("\n"));
  }

  if (dealsRes.data?.length) {
    sections.push("## 최근 바이오 딜\n" + dealsRes.data.map((d: any) =>
      `- [${d.date}] ${d.payer} → ${d.payee}: ${d.technology} (${d.indication}, $${d.total_m}M, ${d.deal_type})`
    ).join("\n"));
  }

  if (clinicalRes.data?.length) {
    sections.push("## 최근 임상시험 승인\n" + clinicalRes.data.map((c: any) =>
      `- [${c.approval_date}] ${c.product_name} (${c.sponsor}) - ${c.phase}: ${c.trial_title}`
    ).join("\n"));
  }

  return sections.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const context = await fetchRecentContext(supabase);

    const SYSTEM_PROMPT = `당신은 제약·바이오 업계 동료처럼 편하게 대화하는 AI입니다.
- 존댓말로 답변해주세요.
- 짧고 자연스러운 대화체로 답변해주세요. 보고서처럼 쓰지 마세요.
- 핵심만 간결하게, 길어도 3~4문장 이내로 답변해주세요.
- 사용자가 더 알고 싶어하면 그때 자세히 설명해주세요.
- 한국어로 답변하되, 약물명은 영문 병기 가능합니다.
- 불확실하면 솔직하게 말씀해주세요.
- 오늘 날짜: ${new Date().toISOString().split("T")[0]}

아래는 최근 3일간의 실시간 업계 데이터입니다. 사용자 질문에 관련된 내용이 있으면 이 데이터를 기반으로 답변해주세요.
질문과 직접 관련이 없으면 일반 지식으로 답변해도 됩니다.

${context || "(최근 데이터 없음)"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "크레딧이 부족합니다." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI 서비스 오류" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pharma-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
