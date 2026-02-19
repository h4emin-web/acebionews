import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCES = [
  { url: "https://substack.com/@kiinbio/posts", label: "Kiinbio", source: "kiinbio" },
  { url: "https://decodingbio.substack.com/archive", label: "Decoding Bio", source: "decodingbio" },
  { url: "https://www.techlifesci.com/s/weekly-highlights", label: "Bio Tech", source: "techlifesci" },
  { url: "https://thebiobrief.substack.com/archive", label: "Bio Brief", source: "thebiobrief" },
];

async function fetchSubstackRSS(source: typeof SOURCES[0]): Promise<Array<{ title: string; url: string; date: string; isFree: boolean }>> {
  // Try RSS feed first for standard substack domains
  const results: Array<{ title: string; url: string; date: string; isFree: boolean }> = [];

  // Determine RSS URL
  let rssUrl = "";
  if (source.source === "kiinbio") {
    rssUrl = "https://kiinbio.substack.com/feed";
  } else if (source.source === "decodingbio") {
    rssUrl = "https://decodingbio.substack.com/feed";
  } else if (source.source === "techlifesci") {
    rssUrl = "https://www.techlifesci.com/feed";
  } else if (source.source === "thebiobrief") {
    rssUrl = "https://thebiobrief.substack.com/feed";
  }

  try {
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BionewsBot/1.0)" },
    });
    if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);
    const xml = await resp.text();

    // Parse RSS items
    const items = xml.split("<item>").slice(1);
    for (const item of items.slice(0, 3)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s) || item.match(/<title>(.*?)<\/title>/s);
      const linkMatch = item.match(/<link>(.*?)<\/link>/s);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/s);

      if (!titleMatch || !linkMatch) continue;

      const title = titleMatch[1].trim();
      const url = linkMatch[1].trim();
      const date = dateMatch ? new Date(dateMatch[1].trim()).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      // Check if free: look for paywall indicators
      // Substack RSS typically only includes free posts, but we double check
      const isFree = !item.includes("paywall") && !item.includes("subscriber-only");

      results.push({ title, url, date, isFree });
    }
  } catch (e) {
    console.error(`RSS fetch error for ${source.label}:`, e);
  }

  return results;
}

async function summarizeInKorean(title: string, url: string): Promise<string | null> {
  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!GEMINI_KEY) {
    console.error("No GOOGLE_GEMINI_API_KEY");
    return null;
  }

  // Fetch article content via Firecrawl
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  let articleContent = "";

  if (FIRECRAWL_KEY) {
    try {
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (scrapeResp.ok) {
        const scrapeData = await scrapeResp.json();
        articleContent = scrapeData.data?.markdown || scrapeData.markdown || "";
        // Limit content to avoid token limits
        if (articleContent.length > 8000) articleContent = articleContent.substring(0, 8000);
      }
    } catch (e) {
      console.error("Firecrawl scrape error:", e);
    }
  }

  const prompt = articleContent
    ? `다음 바이오/제약 뉴스레터 글을 한국어로 요약해주세요.

제목: ${title}

본문:
${articleContent}

다음 형식으로 작성해주세요:
[핵심 요약]
2~3문장의 핵심 내용 요약 (격식 있는 존댓말 사용, ~입니다/~됩니다)

[주요 내용]
- 핵심 포인트 1
- 핵심 포인트 2
- 핵심 포인트 3
- 핵심 포인트 4 (필요시)

가독성 좋게 작성하되, 전문적인 제약/바이오 용어는 유지해주세요.`
    : `다음 바이오/제약 뉴스레터 글 제목을 기반으로 간략한 한국어 설명을 작성해주세요.
제목: ${title}
URL: ${url}

[핵심 요약] 형식으로 1~2문장 작성해주세요. 격식 있는 존댓말(~입니다) 사용.`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
        }),
      }
    );
    if (!resp.ok) {
      console.error("Gemini error:", resp.status);
      return null;
    }
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error("Gemini call error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const maxPerSource = body.limit || 2;

    let totalInserted = 0;

    for (const source of SOURCES) {
      console.log(`Fetching ${source.label}...`);
      const posts = await fetchSubstackRSS(source);
      const freePosts = posts.filter((p) => p.isFree).slice(0, maxPerSource);
      console.log(`${source.label}: ${freePosts.length} free posts found`);

      for (const post of freePosts) {
        // Check if already exists
        const { data: existing } = await supabase
          .from("substack_posts")
          .select("id")
          .eq("url", post.url)
          .maybeSingle();

        if (existing) {
          console.log(`Skipping existing: ${post.title}`);
          continue;
        }

        // Summarize
        console.log(`Summarizing: ${post.title}`);
        const summary = await summarizeInKorean(post.title, post.url);

        const { error } = await supabase.from("substack_posts").insert({
          title: post.title,
          source: source.source,
          source_label: source.label,
          url: post.url,
          date: post.date,
          summary: summary,
          is_free: true,
        });

        if (error) {
          console.error(`Insert error for ${post.title}:`, error);
        } else {
          totalInserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Crawl substack error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
