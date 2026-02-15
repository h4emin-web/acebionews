import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, summary, keywords } = await req.json();
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const makeRequest = async () => {
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `당신은 원료의약품(API) 산업 전문 분석가입니다. 반드시 유효한 JSON만 출력하세요.`,
            },
            {
              role: "user",
              content: `아래 뉴스를 분석하여 JSON으로 응답하세요.

제목: ${title}
요약: ${summary}
키워드: ${(keywords || []).join(", ")}

다음 JSON 형식으로 정확히 응답하세요:
{
  "businessImplication": "비즈니스 영향을 1~2문장으로 간결하게",
  "affectedMaterials": [
    {
      "name": "원료의약품명 (영문명)",
      "role": "Active 또는 Excipient 또는 Intermediate",
      "relevance": "high 또는 medium 또는 low",
      "status": "STABLE 또는 RISK 또는 OPPORTUNITY"
    }
  ],
  "riskLevel": "low 또는 medium 또는 high",
  "category": "규제 또는 시장 또는 공급망 또는 R&D"
}

중요 규칙:
- affectedMaterials에는 기사에 직접 언급된 API뿐만 아니라, 같은 약효군·대체재·경쟁 API·관련 중간체 등을 포함하여 최소 3개 이상 추천
- 예: 리바록사반 기사라면 아픽사반, 에독사반, 다비가트란 등 경쟁 항응고제도 포함
- name은 반드시 "한글명 (English Name)" 형식
- businessImplication은 2줄 이내로 간결하게
- JSON만 출력하세요`,
            },
          ],
        }),
      });
    };

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await makeRequest();
      if (response.ok || response.status !== 429) break;
      console.log(`Rate limited, retrying in ${(attempt + 1) * 2}s...`);
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response?.text();
      console.error("AI gateway error:", response?.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(jsonStr);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
