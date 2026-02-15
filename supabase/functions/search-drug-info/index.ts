import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword } = await req.json();
    if (!keyword) throw new Error("keyword is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    console.log(`Generating ingredient profile for: ${keyword}`);

    const prompt = `당신은 원료의약품(API) 전문가입니다. "${keyword}" 원료의약품에 대해 아래 JSON 형식으로 정확하게 답변하세요.

반드시 아래 JSON 형식만 출력하세요:
{
  "nameKo": "한글명",
  "nameEn": "English Name",
  "cas": "CAS 번호 (모르면 null)",
  "category": "약효 분류",
  "mechanism": "작용기전을 1~2문장으로 간결하게",
  "indications": ["적응증1", "적응증2", "적응증3"],
  "dosageForms": ["제형1", "제형2"],
  "sideEffects": ["주요 부작용1", "부작용2", "부작용3"],
  "originatorCompany": "오리지네이터 제약사명",
  "originatorBrand": "오리지네이터 제품 브랜드명",
  "patentStatus": "특허 상태 간단 설명",
  "marketTrend": "시장 동향을 2~3문장으로",
  "relatedApis": ["관련/경쟁 API 1", "관련/경쟁 API 2", "관련/경쟁 API 3"],
  "domesticProducts": [
    {"name": "제품명", "company": "제조사", "dosageForm": "제형", "strength": "함량"}
  ],
  "dmfRecords": [
    {"ingredientName": "성분명", "applicant": "신청인", "manufacturer": "제조소명", "manufacturerAddress": "제조소소재지", "country": "제조국가"}
  ]
}

중요 규칙:
- domesticProducts: 한국 식약처(MFDS)에 등록된 해당 원료 함유 의약품을 최대 10개. 실제 허가된 제품만 기재.
- dmfRecords: 한국 식약처 의약품안전나라(nedrug.mfds.go.kr)의 원료의약품등록(DMF) 공고에 등록된 해당 원료 DMF 정보. 실제 등록된 것만 기재. 최대 10개.
- 정확한 정보만 제공하세요. 모르는 항목은 null 또는 빈 배열로.
- JSON만 출력하세요.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const profile = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ success: true, profile }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("search-drug-info error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
