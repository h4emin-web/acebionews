import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;

    // Find untranslated foreign articles
    const { data: untranslated } = await supabase
      .from("news_articles")
      .select("id, title, summary, region, country")
      .eq("region", "해외")
      .order("created_at", { ascending: false })
      .limit(limit);

    const needsTranslation = (untranslated || []).filter((a: any) => {
      const title = a.title || "";
      // Count Korean chars vs total meaningful chars
      const koreanChars = (title.match(/[가-힣]/g) || []).length;
      const latinChars = (title.match(/[a-zA-Z]/g) || []).length;
      const jpChars = (title.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
      const cnChars = (title.match(/[\u4E00-\u9FFF]/g) || []).length;
      // If title is mostly foreign (Korean chars < 30% of meaningful chars), needs translation
      const totalMeaningful = koreanChars + latinChars + jpChars + cnChars;
      if (totalMeaningful === 0) return false;
      const koreanRatio = koreanChars / totalMeaningful;
      return koreanRatio < 0.3;
    });

    console.log(`Found ${needsTranslation.length} untranslated foreign articles`);

    if (needsTranslation.length === 0) {
      return new Response(JSON.stringify({ success: true, translated: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let translated = 0;
    const tBatchSize = 10;

    for (let i = 0; i < needsTranslation.length; i += tBatchSize) {
      const batch = needsTranslation.slice(i, i + tBatchSize);
      const articleList = batch.map((a: any, idx: number) => `[${idx}] ${a.title} | ${a.summary?.slice(0, 200) || ""}`).join("\n");

      try {
        const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `제약/바이오 뉴스 번역 전문가입니다. 영어, 일본어, 중국어 기사를 한국어로 번역하세요.
- translated_title: 기사 제목을 한국어로 번역. 반드시 제공.
- translated_summary: 기사 핵심 내용을 한국어 2문장 이내로 요약. 존댓말(~입니다, ~됩니다) 사용.
- 생소한 전문 용어나 약물명이 있으면 괄호로 간단히 설명 추가.
- 의약품 명칭은 식약처(MFDS) 공식 표기법 준수.
모든 기사에 대해 반드시 번역을 제공해야 합니다.`,
              },
              { role: "user", content: `Translate these articles to Korean:\n\n${articleList}` },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "translate_articles",
                  description: "Translate articles to Korean",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number" },
                            translated_title: { type: "string" },
                            translated_summary: { type: "string" },
                          },
                          required: ["index", "translated_title", "translated_summary"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "translate_articles" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            for (const r of parsed.results || []) {
              const article = batch[r.index];
              if (!article || !r.translated_title) continue;
              await supabase
                .from("news_articles")
                .update({ title: r.translated_title, summary: r.translated_summary || article.summary })
                .eq("id", article.id);
              translated++;
            }
          }
        } else {
          console.error(`Gemini error: ${aiResp.status}`);
        }
      } catch (err) {
        console.error("Translation batch error:", err);
      }
      if (i + tBatchSize < needsTranslation.length) await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`Translated ${translated}/${needsTranslation.length} articles`);
    return new Response(
      JSON.stringify({ success: true, translated, total: needsTranslation.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("translate-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
