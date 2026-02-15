import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 3000,
    }),
  });

  if (!resp.ok) {
    console.error(`Scrape failed for ${url}: ${resp.status}`);
    return "";
  }

  const data = await resp.json();
  return data.data?.markdown || data.markdown || "";
}

async function parseProductsWithAI(markdown: string, keyword: string) {
  if (!markdown || markdown.length < 50) return null;

  const prompt = `다음은 의약품안전나라에서 "${keyword}" 원료를 검색한 결과입니다. 
등록된 의약품 제품 목록을 모두 추출해 JSON 배열로 반환하세요.
각 항목: {"name": "제품명", "company": "업체명", "type": "전문/일반", "form": "제형"}
중복된 제품은 제거하세요 (같은 제품명+업체명은 하나만).
JSON 배열만 반환하세요.

${markdown.slice(0, 15000)}`;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

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

  if (!aiResp.ok) return null;

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

async function getDmfFromAI(keyword: string, koreanName: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return [];

  const prompt = `한국 식약처(MFDS) 원료의약품등록(DMF) 현황에서 "${koreanName}" (영문: ${keyword}) 성분의 DMF 등록 정보를 알려주세요.

실제 등록된 정보만 정확하게 제공하세요. 모르는 정보는 추측하지 마세요.
각 등록 건에 대해: 신청인(업체명), 제조소명(영문 그대로), 제조국가를 포함하세요.
중복 항목은 제거하세요 (같은 업체+제조소는 하나만).

JSON 배열로만 반환: [{"company": "신청인", "manufacturer": "제조소명", "country": "제조국가"}]
정보가 없으면 빈 배열 []을 반환하세요.`;

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

  if (!aiResp.ok) return [];

  const aiData = await aiResp.json();
  const content = aiData.choices?.[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const results = JSON.parse(jsonMatch[0]);
    // Deduplicate by company+manufacturer
    const seen = new Set<string>();
    return results.filter((r: any) => {
      const key = `${r.company}|${r.manufacturer}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword } = await req.json();
    if (!keyword) throw new Error("keyword is required");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    console.log(`Searching drug info for: ${keyword}`);

    const cleanKeyword = keyword.replace(/\s*\(.*\)\s*$/, "").trim();
    const englishMatch = keyword.match(/\(([^)]+)\)/);
    const englishName = englishMatch ? englishMatch[1] : cleanKeyword;
    const koreanName = cleanKeyword;

    // Product search - try Korean name first, then English
    const productUrlKr = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&page=1&searchDivision=detail&itemName=&entpName=&ingrName=${encodeURIComponent(koreanName)}&itemSeq=&materialName=&mtralSe=&ediCode=&typeName=`;
    const productUrlEn = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&page=1&searchDivision=detail&itemName=&entpName=&ingrName=${encodeURIComponent(englishName)}&itemSeq=&materialName=&mtralSe=&ediCode=&typeName=`;

    // DMF: use AI knowledge (MFDS DMF page doesn't support URL-based search)
    const [productMarkdownKr, productMarkdownEn, dmfRecords] = await Promise.all([
      scrapeWithFirecrawl(productUrlKr, FIRECRAWL_API_KEY),
      koreanName !== englishName ? scrapeWithFirecrawl(productUrlEn, FIRECRAWL_API_KEY) : Promise.resolve(""),
      getDmfFromAI(englishName, koreanName),
    ]);

    // Use whichever product markdown has more content
    const productMarkdown = productMarkdownKr.length > productMarkdownEn.length ? productMarkdownKr : productMarkdownEn;
    console.log(`Scraped products KR: ${productMarkdownKr.length}, EN: ${productMarkdownEn.length}, DMF AI results: ${dmfRecords.length}`);

    const products = await parseProductsWithAI(productMarkdown, koreanName || englishName);

    // Deduplicate products
    const seen = new Set<string>();
    const uniqueProducts = (products || []).filter((p: any) => {
      const key = `${p.name}|${p.company}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const dmfUrl = `https://nedrug.mfds.go.kr/pbp/CCBAC03`;

    return new Response(
      JSON.stringify({
        success: true,
        keyword: koreanName || englishName,
        products: uniqueProducts,
        dmfRecords: dmfRecords || [],
        productUrl: productUrlKr,
        dmfUrl,
      }),
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
