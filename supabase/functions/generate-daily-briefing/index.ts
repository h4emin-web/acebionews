import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 어제~오늘 뉴스 가져오기
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
      .map((n: any) => `[${n.region}/${n.source}] ${n.title}`)
      .join("\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.0-flash",
          max_tokens: 1000,
          messages: [
            {
              role: "system",
              content: `당신은 제약·바이오 산업 전문 에디터입니다. 오늘의 주요 뉴스를 간결하고 임팩트 있게 브리핑해주세요.
응답은 반드시 아래 JSON 형식으로만 반환하세요. (마크다운 코드블록 없이 순수 JSON)
{
  "headline": "오늘의 한줄 헤드라인 (20자 이내)",
  "items": [
    { "emoji": "💊", "title": "주제 (10자 이내)", "summary": "2~3줄 요약" }
  ],
  "insight": "에디터 코멘트 — 전체 흐름을 한 문장으로"
}
items는 최대 5개, 가장 중요한 것만.`,
            },
            {
              role: "user",
              content: `다음 오늘의 뉴스를 브리핑해주세요:\n\n${newsList}`,
            },
          ],
        }),
      }
    );

    const aiData = await response.json();
    const text = aiData.choices?.[0]?.message?.content || "{}";
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
