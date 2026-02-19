import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, type } = await req.json();
    if (!keyword) throw new Error("keyword is required");

    if (type === "dmf") {
      const results = await scrapeDmf(keyword);
      return new Response(JSON.stringify({ success: true, dmfRecords: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const results = await scrapeProducts(keyword);
      return new Response(JSON.stringify({ success: true, domesticProducts: results }), {
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

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

// Strip HTML and remove leading Korean labels like "신청인 ", "등록번호 " etc.
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function removeLabel(text: string): string {
  // Remove common DMF table labels that get merged with values
  return text
    .replace(/^(대상의약품|등록번호|성분명|신청인|제조소명|발급일자|업소명|제조소소재지|제조국가|최초등록일자|최종변경일자|최종연차보고년도|취소\/취하구분|취소\/취하일자|문서번호|연계심사문서번호)\s*/g, "")
    .trim();
}

// Extract cells from a row - simple approach, no nested table handling
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = cellRegex.exec(rowHtml)) !== null) {
    cells.push(stripHtml(m[1]));
  }
  return cells;
}

async function scrapeProducts(keyword: string) {
  const isEnglish = /^[a-zA-Z\s\-]+$/.test(keyword.trim());
  const params = new URLSearchParams();
  if (isEnglish) {
    params.set("ingrEngName", keyword);
  } else {
    params.set("ingrName1", keyword);
  }
  params.set("indutyClassCode", "A0");

  const url = `https://nedrug.mfds.go.kr/searchDrug?${params.toString()}`;
  console.log(`Fetching products: ${url}`);

  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) {
    console.error("Product fetch failed:", resp.status);
    return [];
  }

  const html = await resp.text();
  return parseProductsHtml(html);
}

function parseProductsHtml(html: string): any[] {
  const products: any[] = [];

  // Only grab the first tbody to reduce processing
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const tbody = tbodyMatch[1];
  // Remove all nested tables first to prevent regex issues
  const cleanTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, "");

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(cleanTbody)) !== null) {
    const cells = extractCells(rowMatch[1]);
    if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
      products.push({
        name: cells[1] || "",
        nameEn: cells[2] || "",
        company: cells[3] || "",
        companyEn: cells[4] || "",
        code: cells[5] || "",
        permitDate: cells[7] || "",
        category: cells[8] || "",
      });
    }
    if (products.length >= 10) break;
  }

  console.log(`Parsed ${products.length} products`);
  return products;
}

async function scrapeDmf(keyword: string) {
  const isEnglish = /^[a-zA-Z\s\-]+$/.test(keyword.trim());
  const params = new URLSearchParams();
  if (isEnglish) {
    params.set("searchIngrEngName", keyword);
  } else {
    params.set("searchIngrKorName", keyword);
  }

  const url = `https://nedrug.mfds.go.kr/pbp/CCBAC03/getList?${params.toString()}`;
  console.log(`Fetching DMF: ${url}`);

  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) {
    console.error("DMF fetch failed:", resp.status);
    return [];
  }

  const html = await resp.text();
  return parseDmfHtml(html);
}

function parseDmfHtml(html: string): any[] {
  const records: any[] = [];

  const countMatch = html.match(/총\s*([\d,]+)건/);
  const totalCount = countMatch ? countMatch[1] : "0";
  console.log(`DMF total count: ${totalCount}`);

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    console.log("No tbody found in DMF HTML");
    return [];
  }

  const tbody = tbodyMatch[1];

  // Replace nested tables with their text content, deduplicating repeated entries
  const flatTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    // Extract each row's text from the nested table
    const rowTexts: string[] = [];
    const nestedRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let nr;
    while ((nr = nestedRowRegex.exec(match)) !== null) {
      const text = stripHtml(nr[1]).trim();
      if (text && !rowTexts.includes(text)) rowTexts.push(text);
    }
    return rowTexts.join(", ");
  });

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(flatTbody)) !== null) {
    const cells = extractCells(rowMatch[1]);
    const cleaned = cells.map(removeLabel).filter(c => c.length > 0);

    if (records.length === 0) {
      console.log(`First row cells (${cleaned.length}):`, JSON.stringify(cleaned.slice(0, 12)));
    }

    // Structure: [번호, 대상의약품, 등록번호, 성분명, 신청인, 제조소명, 날짜들..., 상태]
    if (cleaned.length >= 6 && /^\d+$/.test(cleaned[0])) {
      const status = cleaned.find(c => c === "정상" || c === "취하" || c === "취소") || "정상";
      const dateIdx = cleaned.findIndex((c, idx) => idx >= 6 && /^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/.test(c));
      const registrationDate = dateIdx >= 0 ? cleaned[dateIdx] : "";

      // Deduplicate manufacturer name (e.g. "Bayer AGBayer AGBayer AG" → "Bayer AG")
      let mfr = cleaned[5] || "";
      if (mfr.length > 3) {
        // Try to find repeated substring
        for (let len = 3; len <= mfr.length / 2; len++) {
          const sub = mfr.slice(0, len);
          if (mfr === sub.repeat(mfr.length / sub.length)) {
            mfr = sub;
            break;
          }
        }
      }

      records.push({
        ingredientName: cleaned[3] || "",
        applicant: cleaned[4] || "",
        manufacturer: mfr,
        registrationDate,
        status,
      });
    }
    if (records.length >= 10) break;
  }

  console.log(`Parsed ${records.length} DMF records`);
  return records;
}
