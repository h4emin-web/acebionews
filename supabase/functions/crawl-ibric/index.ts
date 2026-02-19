import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IBRIC_BASE_URL = "https://www.ibric.org/bric/trend/bio-report.do";

function getPageUrl(page: number): string {
  return `${IBRIC_BASE_URL}?mode=list&srCategoryId=100&page=${page}`;
}

async function scrapeIbricPage(pageUrl: string, firecrawlKey: string): Promise<IbricItem[]> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: pageUrl, formats: ["markdown"], onlyMainContent: true }),
    });

    if (!resp.ok) {
      console.error("Firecrawl scrape failed:", resp.status);
      return [];
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";
    console.log("Markdown length:", markdown.length);

    const items: IbricItem[] = [];
    const blocks = markdown.split(/- \[!\[/);

    for (const block of blocks) {
      const urlMatch = block.match(/mode=view&articleNo=(\d+)&srCategoryId=100/);
      if (!urlMatch) continue;

      const articleNo = urlMatch[1];
      const url = `${IBRIC_BASE_URL}?mode=view&articleNo=${articleNo}&srCategoryId=100`;

      const titleRegex = new RegExp(`\\[([^\\]]{5,})\\]\\(https://www\\.ibric\\.org/bric/trend/bio-report\\.do\\?mode=view&articleNo=${articleNo}[^)]*\\)`);
      const titleMatch = block.match(titleRegex);
      if (!titleMatch) continue;
      const title = titleMatch[1].trim();
      if (title.includes("자세히 보기")) continue;

      const authorMatch = block.match(/([가-힣]{2,5})\(([^)]+)\)/);
      const author = authorMatch ? authorMatch[1] : "";
      const affiliation = authorMatch ? authorMatch[2] : "";

      const dateMatch = block.match(/(\d{4})\.(\d{2})\.(\d{2})\./);
      const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split("T")[0];

      if (items.some(i => i.url === url)) continue;

      items.push({ title, author, affiliation, description: "", url, date, views: 0 });
    }

    return items;
  } catch (e) {
    console.error("Scrape error:", e);
    return [];
  }
}

async function scrapeIbricList(pages: number = 2): Promise<IbricItem[]> {
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_KEY) {
    console.error("No FIRECRAWL_API_KEY");
    return [];
  }

  const allItems: IbricItem[] = [];
  const seenUrls = new Set<string>();

  for (let page = 1; page <= pages; page++) {
    console.log(`Scraping IBRIC page ${page}...`);
    const pageItems = await scrapeIbricPage(getPageUrl(page), FIRECRAWL_KEY);
    for (const item of pageItems) {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allItems.push(item);
      }
    }
  }

  return allItems;
}

async function summarizeInKorean(title: string, url: string, description: string): Promise<string | null> {
  const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
  if (!GEMINI_KEY) return null;

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
        if (articleContent.length > 15000) articleContent = articleContent.substring(0, 15000);
      }
    } catch (e) {
      console.error("Firecrawl article scrape error:", e);
    }
  }

  const prompt = articleContent
    ? `다음 바이오/제약 동향 리포트를 한국어로 상세하게 요약해주세요. 내용을 빠뜨리지 말고 충실하게 작성해야 합니다.

제목: ${title}

본문:
${articleContent}

다음 형식으로 작성해주세요:

[핵심 요약]
3~4문장으로 이 글의 핵심 메시지와 의미를 요약 (격식 있는 존댓말 사용, ~입니다/~됩니다)

본문에서 나뉘는 주제가 있다면 각 주제별로 소제목을 달아 상세히 설명해주세요.
각 주제는 아래와 같은 형식으로 작성합니다:

[주제명] (예: AI 신약개발 트렌드, 기술 동향, 시장 분석 등)
해당 주제의 핵심 내용을 2~3문장으로 설명하고, 구체적 사례/수치/기업명을 포함합니다.
- 세부 포인트 1 (구체적 내용, 수치 포함)
- 세부 포인트 2
- 세부 포인트 3

주제가 여러 개면 위 형식을 반복합니다. 최소 3개 이상의 주제로 나눠주세요.

[핵심 인사이트]
이 리포트의 산업적 의미와 시사점을 1~2문장으로 제시 (투자 조언은 절대 금지, 산업 트렌드 분석만)

작성 규칙:
- 내용을 절대 빠뜨리지 마세요. 본문의 모든 주요 내용을 포함해야 합니다.
- 구체적인 기업명, 금액, 수치, 임상 단계 등을 반드시 포함하세요.
- 전문적인 제약/바이오 용어는 유지하세요.
- 격식 있는 존댓말(~입니다/~됩니다)을 사용하세요.
- 가독성을 최우선으로 작성하세요.
- 절대 마크다운 헤더(#, ##, ###)를 사용하지 마세요. 소제목은 반드시 [대괄호] 형식만 사용하세요.
- 소제목 예시: [1. AI 신약개발 트렌드], [2. 시장 동향], [핵심 인사이트] 등`
    : `다음 바이오/제약 동향 리포트 제목과 설명을 기반으로 간략한 한국어 설명을 작성해주세요.
제목: ${title}
설명: ${description}

[핵심 요약] 형식으로 2~3문장 작성해주세요. 격식 있는 존댓말(~입니다) 사용.`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
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

    // Single article mode
    if (body.single_url) {
      const { single_url, title, author, affiliation, date } = body;
      
      // Check if already exists
      const { data: existing } = await supabase
        .from("ibric_reports")
        .select("id")
        .eq("url", single_url)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, message: "Already exists", inserted: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Summarizing single article: ${title}`);
      const summary = await summarizeInKorean(title, single_url, "");

      const { error } = await supabase.from("ibric_reports").insert({
        title,
        author: author || null,
        affiliation: affiliation || null,
        description: null,
        summary,
        url: single_url,
        date,
        views: 0,
      });

      if (error) {
        console.error("Insert error:", error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, inserted: 1, title }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pages = body.pages || 2;
    const maxItems = body.limit || 20;

    console.log(`Fetching IBRIC trend reports (pages: ${pages})...`);
    const items = await scrapeIbricList(pages);
    console.log(`Found ${items.length} items`);

    let totalInserted = 0;

    for (const item of items.slice(0, maxItems)) {
      // Check if already exists
      const { data: existing } = await supabase
        .from("ibric_reports")
        .select("id")
        .eq("url", item.url)
        .maybeSingle();

      if (existing) {
        console.log(`Skipping existing: ${item.title}`);
        continue;
      }

      // Summarize
      console.log(`Summarizing: ${item.title}`);
      const summary = await summarizeInKorean(item.title, item.url, item.description);

      // Parse date from "2026.02.12" format
      const dateFormatted = item.date.replace(/\./g, "-");

      const { error } = await supabase.from("ibric_reports").insert({
        title: item.title,
        author: item.author || null,
        affiliation: item.affiliation || null,
        description: item.description || null,
        summary,
        url: item.url,
        date: dateFormatted,
        views: item.views,
      });

      if (error) {
        console.error(`Insert error for ${item.title}:`, error);
      } else {
        totalInserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: totalInserted, found: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Crawl IBRIC error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
