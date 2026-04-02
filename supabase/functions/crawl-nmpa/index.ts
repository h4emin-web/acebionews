import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NMPA_LIST_URL = "https://www.nmpa.gov.cn/yaopin/ypggtg/index.html";
const SUSPENSION_PREFIX = "国家药监局关于暂停进口";

function slugId(url: string, title: string): string {
  const m = url.match(/[?&]([A-Za-z0-9_-]{8,})/);
  if (m) return m[1];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (Math.imul(31, h) + title.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function firecrawlScrape(url: string, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, waitFor: 4000 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) {
    console.error(`Firecrawl error for ${url}: ${resp.status}`);
    return "";
  }
  const data = await resp.json();
  return data.data?.markdown || data.markdown || "";
}

interface NmpaArticle {
  id: string;
  title: string;
  url: string;
  date: string;
}

function parseListMarkdown(markdown: string): NmpaArticle[] {
  const articles: NmpaArticle[] = [];
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const linkRegex = /\[([^\]]+)\]\(((?:https?:\/\/www\.nmpa\.gov\.cn)?\/yaopin\/ypggtg\/[^\)\s]+\.html[^\)]*)\)/g;
  const dateRegex = /(\d{4}[-\/]\d{2}[-\/]\d{2})/;

  let m;
  const seen = new Set<string>();
  while ((m = linkRegex.exec(markdown)) !== null) {
    const title = m[1].trim();
    const url = m[2].trim();

    if (title.length < 5 || seen.has(url)) continue;
    if (!title.match(/[\u4e00-\u9fff]/)) continue;

    // Date may be embedded in the link text as "(YYYY-MM-DD)" at the end
    const titleDateMatch = title.match(/\s*\((\d{4}-\d{2}-\d{2})\)\s*$/);
    let cleanTitle = title;
    let dateStr = "";

    if (titleDateMatch) {
      dateStr = titleDateMatch[1];
      cleanTitle = title.replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, "").trim();
    } else {
      // Fall back to surrounding context
      const surrounding = markdown.slice(Math.max(0, m.index - 100), m.index + 200);
      const dateMatch = surrounding.match(dateRegex);
      dateStr = dateMatch ? dateMatch[1].replace(/\//g, "-") : "";
    }

    if (dateStr) {
      const articleDate = new Date(dateStr);
      if (articleDate < twoWeeksAgo) continue;
    }

    const fullUrl = url.startsWith("http") ? url : `https://www.nmpa.gov.cn${url}`;
    seen.add(fullUrl);
    articles.push({
      id: slugId(fullUrl, cleanTitle),
      title: cleanTitle,
      url: fullUrl,
      date: dateStr || new Date().toISOString().split("T")[0],
    });
  }

  console.log(`Parsed ${articles.length} NMPA articles from list`);
  return articles.slice(0, 30);
}

async function summarizeWithAI(
  title: string,
  body: string,
  apiKey: string
): Promise<{ titleKo: string; summary: string }> {
  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `당신은 중국 NMPA(국가약품감독관리국) 공문서를 분석하는 전문가입니다.

아래 공문의 제목과 본문을 읽고 JSON으로 응답하세요:

{
  "title_ko": "제목의 정확한 한국어 번역",
  "summary": "리포트 형식의 한국어 요약 (신문 문체 ~했다, ~이다, ~됐다 사용)"
}

요약 작성 규칙:
- title_ko: 중국어 제목을 정확하고 완전하게 한국어로 번역하세요.
- summary: 본문 내용만 요약하세요.
- 리포트 형식으로 핵심 내용을 빠짐없이 작성하세요.
- 대상 의약품명(성분명/제품명), 해당 기업, 국가, 조치 내용, 이유, 효력 날짜 등 구체적 사실을 포함하세요.
- 内容이 "수입 중단(暂停进口)"인 경우 반드시 중단 대상 품목과 이유를 명시하세요.
- 문장은 완전하게 끝내고 "..."으로 끝내지 마세요.
- 신문 문체(~했다, ~이다, ~됐다, ~한다)로 통일하세요.
- 내용이 길어도 핵심 정보가 누락되지 않도록 충분히 작성하세요.`,
          },
          {
            role: "user",
            content: `제목: ${title}\n\n본문:\n${body.slice(0, 4000)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!resp.ok) {
    console.error("AI error:", resp.status, await resp.text().catch(() => ""));
    return { titleKo: "", summary: "" };
  }

  const data = await resp.json();
  try {
    const content = data.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      titleKo: parsed.title_ko || "",
      summary: parsed.summary || "",
    };
  } catch {
    return { titleKo: "", summary: "" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not set");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Fetching NMPA list...");
    const listMarkdown = await firecrawlScrape(NMPA_LIST_URL, FIRECRAWL_API_KEY);
    if (!listMarkdown) {
      return new Response(JSON.stringify({ error: "Failed to fetch NMPA list" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articles = parseListMarkdown(listMarkdown);
    if (articles.length === 0) {
      console.log("No NMPA articles found in last 2 weeks");
      return new Response(JSON.stringify({ success: true, fetched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("nmpa_notices")
      .select("id")
      .in("id", articles.map(a => a.id));
    const existingIds = new Set((existing || []).map((e: any) => e.id));
    const newArticles = articles.filter(a => !existingIds.has(a.id));
    console.log(`${newArticles.length} new NMPA articles to process`);

    let insertedCount = 0;
    for (let i = 0; i < newArticles.length; i += 3) {
      const batch = newArticles.slice(i, i + 3);
      await Promise.all(batch.map(async (article) => {
        try {
          const body = await firecrawlScrape(article.url, FIRECRAWL_API_KEY);

          const { titleKo, summary } = await summarizeWithAI(
            article.title,
            body || article.title,
            LOVABLE_API_KEY
          );

          const isSuspensionAlert = article.title.startsWith(SUSPENSION_PREFIX);

          const { error } = await supabase.from("nmpa_notices").insert({
            id: article.id,
            title: article.title,
            title_ko: titleKo,
            summary,
            url: article.url,
            date: article.date,
            is_suspension_alert: isSuspensionAlert,
          });

          if (error && error.code !== "23505") {
            console.error(`Insert error for ${article.id}:`, error);
          } else {
            insertedCount++;
            if (isSuspensionAlert) {
              console.log(`SUSPENSION ALERT: ${article.title}`);
            }
          }
        } catch (e) {
          console.error(`Error processing ${article.url}:`, e);
        }
      }));

      if (i + 3 < newArticles.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`NMPA: inserted ${insertedCount}/${newArticles.length} new notices`);
    return new Response(
      JSON.stringify({ success: true, fetched: articles.length, inserted: insertedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-nmpa error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
