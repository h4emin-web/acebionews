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

async function parseWithAI(markdown: string, keyword: string, type: string) {
  if (!markdown || markdown.length < 50) return null;

  const prompt = type === "products"
    ? `다음은 의약품안전나라에서 "${keyword}" 원료를 검색한 결과입니다. 
등록된 의약품 제품 목록을 모두 추출해 JSON 배열로 반환하세요.
각 항목: {"name": "제품명", "company": "업체명", "type": "전문/일반", "form": "제형"}
개수 제한 없이 모두 추출하세요. JSON 배열만 반환하세요.

${markdown.slice(0, 15000)}`
    : `다음은 의약품안전나라 DMF(원료의약품등록) 등록현황 페이지에서 "${keyword}" 성분으로 검색한 결과입니다.

주의: 이 페이지의 데이터에서 "${keyword}" 성분과 관련된 DMF 등록 정보만 추출하세요.
성분명 필드에 "${keyword}"가 포함된 행만 추출하세요. 관련없는 다른 성분의 DMF 정보는 제외하세요.

각 항목을 JSON 배열로 반환: {"company": "신청인(업체명)", "manufacturer": "제조소명(영문 그대로)", "country": "제조국가"}
JSON 배열만 반환하세요. 관련 항목이 없으면 빈 배열 []을 반환하세요.

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
    const searchTerm = englishMatch ? englishMatch[1] : cleanKeyword;

    // Product search URL - uses ingrName parameter for ingredient name search
    const productUrl = `https://nedrug.mfds.go.kr/searchDrug?searchYn=true&page=1&searchDivision=detail&itemName=&entpName=&ingrName=${encodeURIComponent(searchTerm)}&itemSeq=&materialName=&mtralSe=&ediCode=&typeName=`;
    
    // DMF search URL - uses sIngredient for ingredient search  
    const dmfUrl = `https://nedrug.mfds.go.kr/pbp/CCBAC03?searchYn=true&page=1&searchDivision=detail&sIngredient=${encodeURIComponent(searchTerm)}`;

    const [productMarkdown, dmfMarkdown] = await Promise.all([
      scrapeWithFirecrawl(productUrl, FIRECRAWL_API_KEY),
      scrapeWithFirecrawl(dmfUrl, FIRECRAWL_API_KEY),
    ]);

    console.log(`Scraped products: ${productMarkdown.length} chars, DMF: ${dmfMarkdown.length} chars`);

    const [products, dmfRecords] = await Promise.all([
      parseWithAI(productMarkdown, searchTerm, "products"),
      parseWithAI(dmfMarkdown, searchTerm, "dmf"),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        keyword: searchTerm,
        products: products || [],
        dmfRecords: dmfRecords || [],
        productUrl,
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