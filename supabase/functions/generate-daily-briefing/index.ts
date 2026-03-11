import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const from = yesterday.toISOString().split("T")[0];

    const { data: news } = await supabase
      .from("news_articles")
      .select("title, summary, source, region, category, api_keywords")
      .gte("date", from)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!news || news.length === 0) {
      return new Response(JSON.stringify({ success: true, briefing: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newsList = news
      .map((n: any) => `[${n.region}/${n.source}] ${n.title}: ${n.summary?.slice(0, 80)}`)
      .join("\n");

    console.log(`Generating briefing from ${news.length} articles`);

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `당신은 원료의약품(API) 수입 업체를 위한 제약·바이오 산업 전문 에디터입니다. 오늘의 주요 뉴스를 원료의약품 관점에서 간결하게 정리해주세요.
응답은 반드시 아래 JSON 형식으로만 반환하세요. (마크다운 코드블록 없이 순수 JSON)
{
  "items": [
    { "emoji": "💊", "title": "주제 (10자 이내)", "summary": "2~3줄 핵심 요약. 관련 원료의약품명이 있으면 언급" }
  ],
  "insight": "오늘 뉴스 전체 흐름을 한 문장으로 정리"
}
items는 최대 5개, 원료의약품·신약·임상·규제·딜 관련 뉴스 우선.`,
            },
            {
              role: "user",
              content: `다음 오늘의 뉴스를 브리핑해주세요:\n\n${newsList}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const text = aiData.choices?.[0]?.message?.content || "{}";
    console.log("AI raw response:", text.slice(0, 200));
    const briefing = JSON.parse(text.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify({ success: true, briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Daily briefing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
