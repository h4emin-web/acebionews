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

// Flatten nested tables, then extract cell values from outer <td> tags
function extractOuterCells(rowHtml: string): string[] {
  // Step 1: Replace ALL nested tables with their text content
  // Handle multi-row nested tables by collecting all inner td text
  let flattened = rowHtml;
  // Keep replacing nested tables until none remain
  while (/<td[^>]*>[\s\S]*?<table/i.test(flattened)) {
    flattened = flattened.replace(
      /(<td[^>]*>[\s\S]*?)<table[^>]*><tbody[^>]*>([\s\S]*?)<\/tbody><\/table>/gi,
      (match, before, tableContent) => {
        // Extract all inner td text values
        const innerTexts: string[] = [];
        const innerTdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let m;
        while ((m = innerTdRegex.exec(tableContent)) !== null) {
          const text = m[1].replace(/<[^>]*>/g, "").trim();
          if (text) innerTexts.push(text);
        }
        return before + innerTexts.join("; ");
      }
    );
  }
  
  // Step 2: Now extract outer td cells
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let cellMatch;
  while ((cellMatch = cellRegex.exec(flattened)) !== null) {
    // Remove s-th labels and remaining HTML
    let val = cellMatch[1]
      .replace(/<span\s+class="s-th">[^<]*<\/span>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    cells.push(val);
  }
  return cells;
}

// Drug search: GET https://nedrug.mfds.go.kr/searchDrug?ingrName1=셀레늄
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
  
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const cells = extractOuterCells(rowMatch[1]);
    
    // Product table: 순번(0), 제품명(1), 제품영문명(2), 업체명(3), 업체영문명(4), 
    // 품목기준코드(5), 허가번호(6), 허가일(7), 품목구분(8), 취소/취하(9)
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
  }
  
  console.log(`Parsed ${products.length} products`);
  return products.slice(0, 10);
}

// DMF: GET https://nedrug.mfds.go.kr/pbp/CCBAC03/getList?searchIngrKorName=셀레늄
async function scrapeDmf(keyword: string) {
  const params = new URLSearchParams();
  params.set("searchIngrKorName", keyword);
  
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
  
  // Find total count
  const countMatch = html.match(/총\s*([\d,]+)건/);
  const totalCount = countMatch ? countMatch[1] : "0";
  console.log(`DMF total count: ${totalCount}`);
  
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    console.log("No tbody found in DMF HTML");
    return [];
  }
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const cells = extractOuterCells(rowMatch[1]);
    
    // DMF columns: 순번(0), 대상의약품(1), 등록번호(2), 성분명(3), 신청인(4),
    // 제조소명(5), 제조소소재지(6), 제조국가(7), 최초등록일자(8),
    // 최종변경일자(9), 최종연차보고년도(10), 취소/취하구분(11), 취소/취하일자(12), 문서번호(13), 연계심사문서번호(14)
    if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
      records.push({
        targetDrug: cells[1] || "",
        registrationNo: cells[2] || "",
        ingredientName: cells[3] || "",
        applicant: cells[4] || "",
        manufacturer: cells[5] || "",
        manufacturerAddress: cells[6] || "",
        country: cells[7] || "",
        registrationDate: cells[8] || "",
        status: cells[11] || "",
      });
    }
  }
  
  console.log(`Parsed ${records.length} DMF records`);
  return records.slice(0, 10);
}
