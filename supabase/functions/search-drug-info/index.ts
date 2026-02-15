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

    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

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
  "relatedApis": ["관련/경쟁 API 1", "관련/경쟁 API 2", "관련/경쟁 API 3"]
}

중요 규칙:
- 정확한 정보만 제공하세요. 모르는 항목은 null 또는 빈 배열로.
- JSON만 출력하세요.`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("Gemini API error:", aiResp.status, t);
      throw new Error("Gemini API error");
    }

    const aiData = await aiResp.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    // Try to extract JSON object even if surrounded by text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("AI did not return valid JSON for:", keyword, "Response:", content.substring(0, 200));
      return new Response(
        JSON.stringify({ success: true, profile: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let profile;
    try {
      profile = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("JSON parse failed for:", keyword);
      return new Response(
        JSON.stringify({ success: true, profile: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
