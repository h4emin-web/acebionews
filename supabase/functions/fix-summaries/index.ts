import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function needsFix(summary: string): boolean {
  if (!summary || summary.trim().length < 10) return false;
  const trimmed = summary.trimEnd();
  if (trimmed.endsWith("...") || trimmed.endsWith("…")) return true;
  const banmalPattern = /(했다|이다|한다|됐다|된다|있다|없다|봤다|줬다|받았다|밝혔다|나타났다|보였다|알렸다|전했다|밝힌다|예정이다|방침이다|계획이다|것이다|셈이다|상황이다|수준이다|전망이다|분석이다|판단이다)[.。]?$/;
  if (banmalPattern.test(trimmed)) return true;
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceStr = since.toISOString().split("T")[0];

    const { data: articles, error } = await supabase
      .from("news_articles")
      .select("id, title, summary, source, region")
      .gte("date", sinceStr)
      .not("summary", "is", null)
      .order("date", { ascending: false });

    if (error) throw error;

    const toFix = (articles || []).filter((a: any) => needsFix(a.summary));
    console.log(`Found ${toFix.length} articles needing fix out of ${articles?.length} total`);

    if (toFix.length === 0) {
      return new Response(JSON.stringify({ success: true, fixed: 0, message: "No articles need fixing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fixedCount = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < toFix.length; i += BATCH_SIZE) {
      const batch = toFix.slice(i, i + BATCH_SIZE);
      const articleList = batch.map((a: any, idx: number) =>
        `[${idx}] 제목: ${a.title}\n현재요약: ${a.summary}`
      ).join("\n\n");

      try {
        const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            messages: [
              {
                role: "system",
                content: `제약·바이오 뉴스 요약문 교정 전문가입니다.

교정 규칙:
- 반드시 존댓말(~습니다, ~됩니다, ~입니다)로 통일
- "~했다", "~이다", "~한다", "~됐다", "~있다", "~없다" 등 반말 종결 절대 금지
- "..."나 "…"로 끝내지 말고 항상 완전한 문장으로 종결
- 최대 4~5문장 이내로 압축
- 원래 핵심 사실(회사명, 약물명, 수치) 유지
- 내용 추가/과장 금지, HTML 엔티티 금지

JSON으로 반환: {"results": [{"index": 0, "summary": "교정된 요약"}, ...]}`,
              },
              {
                role: "user",
                content: `다음 요약문들을 교정해주세요:\n\n${articleList}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!aiResp.ok) {
          console.error(`Gemini error: ${aiResp.status}`);
          continue;
        }

        const aiData = await aiResp.json();
        const rawContent = aiData.choices?.[0]?.message?.content || "{}";
        let results: Array<{ index: number; summary: string }> = [];

        try {
          const parsed = JSON.parse(rawContent);
          results = parsed.results || parsed.summaries || parsed.articles || (Array.isArray(parsed) ? parsed : []);
        } catch {
          console.error("Failed to parse AI response");
          continue;
        }

        for (const r of results) {
          if (typeof r.index !== "number" || !r.summary) continue;
          const article = batch[r.index];
          if (!article || needsFix(r.summary)) continue;

          const { error: updateError } = await supabase
            .from("news_articles")
            .update({ summary: r.summary })
            .eq("id", article.id);

          if (!updateError) fixedCount++;
        }
      } catch (batchErr) {
        console.error(`Batch error:`, batchErr);
      }

      if (i + BATCH_SIZE < toFix.length) await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`Fixed ${fixedCount}/${toFix.length} articles`);
    return new Response(JSON.stringify({ success: true, scanned: articles?.length, needFix: toFix.length, fixed: fixedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fix-summaries error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
