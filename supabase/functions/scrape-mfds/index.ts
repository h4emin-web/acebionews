import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, type } = await req.json();
    if (!keyword) throw new Error("keyword is required");

    if (type === "dmf") {
      const result = await scrapeDmfByIngredient(keyword);
      return new Response(JSON.stringify({ success: true, dmfRecords: result.records, totalCount: result.totalCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // type === "products" or default
      const result = await scrapeProductsByIngredient(keyword);
      return new Response(JSON.stringify({ success: true, domesticProducts: result.products, totalCount: result.totalCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("scrape-mfds error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// 재시도 포함 fetch
async function fetchWithRetry(url: string, maxRetries = 3): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Fetch attempt ${attempt}: ${url}`);
      const resp = await fetch(url, { headers: HEADERS });
      if (resp.ok) {
        return await resp.text();
      }
      console.error(`Attempt ${attempt} failed: HTTP ${resp.status}`);
    } catch (e) {
      console.error(`Attempt ${attempt} error:`, e);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = cellRegex.exec(rowHtml)) !== null) {
    cells.push(stripHtml(m[1]));
  }
  return cells;
}

// ─── 국내 등록 제품 (searchDrug - 성분명1 검색) ───────────────────────────

async function scrapeProductsByIngredient(keyword: string) {
  const isKorean = /[가-힣]/.test(keyword);
  // 한국어면 ingrName1, 영어면 ingrEngName
  const paramKey = isKorean ? "ingrName1" : "ingrEngName";
  // 괄호 안 영어만 있으면 영어 파라미터로
  const cleanKw = keyword.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const enMatch = keyword.match(/\(([^)]+)\)/);

  const allProducts: any[] = [];
  let totalCount = 0;

  const trySearch = async (param: string, value: string) => {
    let page = 1;
    const maxPages = 20;
    while (page <= maxPages) {
      const url = `https://nedrug.mfds.go.kr/searchDrug?${param}=${encodeURIComponent(value)}&page=${page}`;
      const html = await fetchWithRetry(url);
      if (!html) break;

      if (page === 1) {
        const countMatch = html.match(/총\s*([\d,]+)\s*건/);
        totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;
        console.log(`Products total: ${totalCount} (param: ${param}=${value})`);
        if (totalCount === 0) break;
      }

      const rows = parseProductRows(html);
      if (rows.length === 0) break;
      allProducts.push(...rows);
      if (allProducts.length >= totalCount) break;
      page++;
    }
  };

  // 성분명 검색
  await trySearch(paramKey, cleanKw);

  // 결과 없고 영어 성분명 있으면 영어로 재시도
  if (allProducts.length === 0 && enMatch) {
    await trySearch("ingrEngName", enMatch[1].trim());
  }

  console.log(`Products found: ${allProducts.length}`);
  return { products: allProducts, totalCount: totalCount || allProducts.length };
}

function parseProductRows(html: string): any[] {
  const products: any[] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const tbody = tbodyMatch[1].replace(/<table[\s\S]*?<\/table>/gi, "");
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;

  while ((m = rowRegex.exec(tbody)) !== null) {
    const cells = extractCells(m[1]);
    if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
      products.push({
        name: cells[1] || "",
        nameEn: cells[2] || "",
        company: cells[3] || "",
        code: cells[5] || "",
        permitDate: cells[7] || "",
        category: cells[8] || "",
        ingredient: cells[11] || "",
        ingredientEn: cells[12] || "",
      });
    }
  }
  return products;
}

// ─── DMF (CCBAC03 - 성분명 검색) ──────────────────────────────────────────

async function scrapeDmfByIngredient(keyword: string) {
  const isKorean = /[가-힣]/.test(keyword);
  const cleanKw = keyword.replace(/\s*\([^)]*\)\s*/g, "").trim();
  const enMatch = keyword.match(/\(([^)]+)\)/);

  const allRecords: any[] = [];
  let totalCount = 0;

  const trySearch = async (param: string, value: string) => {
    let page = 1;
    const maxPages = 30;
    while (page <= maxPages) {
      const url = `https://nedrug.mfds.go.kr/pbp/CCBAC03/getList?${param}=${encodeURIComponent(value)}&page=${page}`;
      const html = await fetchWithRetry(url);
      if (!html) break;

      if (page === 1) {
        const countMatch = html.match(/총\s*([\d,]+)\s*건/);
        totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;
        console.log(`DMF total: ${totalCount} (param: ${param}=${value})`);
        if (totalCount === 0) break;
      }

      const rows = parseDmfRows(html);
      if (rows.length === 0) break;
      allRecords.push(...rows);
      if (allRecords.length >= totalCount) break;
      page++;
    }
  };

  // 한국어면 한국어 파라미터로, 영어면 영어 파라미터로
  if (isKorean) {
    await trySearch("searchIngrKorName", cleanKw);
    // 결과 없고 영어 성분명 있으면 영어로 재시도
    if (allRecords.length === 0 && enMatch) {
      await trySearch("searchIngrEngName", enMatch[1].trim());
    }
  } else {
    await trySearch("searchIngrEngName", cleanKw);
  }

  console.log(`DMF found: ${allRecords.length}`);
  return { records: allRecords, totalCount: totalCount || allRecords.length };
}

function removeLabel(text: string): string {
  return text
    .replace(/^(대상의약품|등록번호|성분명|신청인|제조소명|발급일자|업소명|제조소소재지|제조국가|최초등록일자|최종변경일자|최종연차보고년도|취소\/취하구분|취소\/취하일자|문서번호|연계심사문서번호)\s*/g, "")
    .trim();
}

function parseDmfRows(html: string): any[] {
  const records: any[] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const tbody = tbodyMatch[1];
  const flatTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    const rows: string[] = [];
    const nr = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = nr.exec(match)) !== null) {
      const t = stripHtml(m[1]).trim();
      if (t && !rows.includes(t)) rows.push(t);
    }
    return rows.join(", ");
  });

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;

  while ((m = rowRegex.exec(flatTbody)) !== null) {
    const cells = extractCells(m[1]).map(removeLabel).filter(c => c.length > 0);
    if (cells.length >= 6 && /^\d+$/.test(cells[0])) {
      const status = cells.find(c => c === "정상" || c === "취하" || c === "취소") || "정상";
      const dateIdx = cells.findIndex((c, idx) => idx >= 6 && /^\d{4}[.\-\/]\d{2}/.test(c));

      // 제조소명 반복 제거
      let mfr = cells[5] || "";
      for (let len = 3; len <= mfr.length / 2; len++) {
        const sub = mfr.slice(0, len);
        if (mfr === sub.repeat(Math.round(mfr.length / sub.length))) { mfr = sub; break; }
      }

      records.push({
        ingredientName: cells[3] || "",
        applicant: cells[4] || "",
        manufacturer: mfr,
        registrationDate: dateIdx >= 0 ? cells[dateIdx] : "",
        status,
      });
    }
  }
  return records;
}
