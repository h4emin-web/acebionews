import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    } else if (type === "ingredient-lookup") {
      const result = await scrapeIngredientByProduct(keyword);
      return new Response(JSON.stringify({ success: true, ingredient: result }), {
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function removeLabel(text: string): string {
  return text
    .replace(/^(대상의약품|등록번호|성분명|신청인|제조소명|발급일자|업소명|제조소소재지|제조국가|최초등록일자|최종변경일자|최종연차보고년도|취소\/취하구분|취소\/취하일자|문서번호|연계심사문서번호)\s*/g, "")
    .trim();
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
  const flatTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
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

    if (cleaned.length >= 6 && /^\d+$/.test(cleaned[0])) {
      const status = cleaned.find(c => c === "정상" || c === "취하" || c === "취소") || "정상";
      const dateIdx = cleaned.findIndex((c, idx) => idx >= 6 && /^\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/.test(c));
      const registrationDate = dateIdx >= 0 ? cleaned[dateIdx] : "";

      let mfr = cleaned[5] || "";
      if (mfr.length > 3) {
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

// ------- Ingredient Lookup (product name → API ingredient) -------

// Strip cell labels like "제품명 ", "제품영문명 " from MFDS table cells
function stripCellLabel(text: string): string {
  return text
    .replace(/^(제품명|제품영문명|업체명|업체명\(영문\)|품목기준코드|허가번호|허가일|품목구분|취소\/취하구분)\s*/g, "")
    .trim();
}

// Step 1: Search MFDS by product name
async function mfdsIngredientLookup(productName: string): Promise<{ nameKo: string | null; nameEn: string | null; productName: string } | null> {
  const params = new URLSearchParams();
  params.set("itemName", productName);

  const url = `https://nedrug.mfds.go.kr/searchDrug?${params.toString()}`;
  console.log(`MFDS ingredient lookup: ${url}`);

  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return null;

  const html = await resp.text();

  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return null;

  const tbody = tbodyMatch[1];
  const cleanTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, "");

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rowMatch = rowRegex.exec(cleanTbody);
  if (!rowMatch) return null;

  const rawCells = extractCells(rowMatch[1]);
  const cells = rawCells.map(stripCellLabel);
  console.log(`MFDS cells (${cells.length}):`, JSON.stringify(cells.slice(0, 10)));

  const fullProductName = cells[1] || "";
  
  // Try extracting ingredient from parentheses in product name
  // e.g. "타이레놀산160밀리그램(아세트아미노펜)" → "아세트아미노펜"
  const ingredientFromName = fullProductName.match(/\(([가-힣a-zA-Z\s\-]+)\)/);
  if (ingredientFromName) {
    const nameKo = ingredientFromName[1].trim();
    const nameEn = cells[2]?.match(/\(([A-Za-z\s\-]+)\)/)?.[1]?.trim() || null;
    console.log(`MFDS: extracted from name parentheses: ${nameKo}`);
    return { nameKo, nameEn, productName: fullProductName };
  }

  // Try detail page — look for 원료약품 section which has a structured table
  const linkMatch = rowMatch[1].match(/href="([^"]*\/drug\/getDrugDetail[^"]*)"/i) ||
                    rowMatch[1].match(/href="([^"]*getDrugDetail[^"]*)"/i) ||
                    rowMatch[1].match(/href="([^"]*\/drug\/[^"]*)"/i);

  if (linkMatch) {
    let detailUrl = linkMatch[1].replace(/&amp;/g, "&");
    if (detailUrl.startsWith("/")) detailUrl = `https://nedrug.mfds.go.kr${detailUrl}`;
    console.log(`Fetching detail page: ${detailUrl}`);

    try {
      const detailResp = await fetch(detailUrl, { headers: HEADERS });
      if (detailResp.ok) {
        const detailHtml = await detailResp.text();
        
        // Look for 원료약품 table section specifically
        // The ingredient info is usually in a table with header containing "원료약품" or "성분"
        const ingredientSectionMatch = detailHtml.match(/원료약품[\s\S]{0,500}?<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
        if (ingredientSectionMatch) {
          const ingredientRows = ingredientSectionMatch[1];
          // Extract ingredient names from the table rows
          const ingredientCells = extractCells(ingredientRows);
          const cleaned = ingredientCells.map(c => c.trim()).filter(c => c.length > 1);
          console.log(`Detail page ingredient cells:`, JSON.stringify(cleaned.slice(0, 8)));
          
          // Find cells that look like ingredient names (Korean pharmaceutical names)
          for (const cell of cleaned) {
            // Skip numeric, date-like, or label-like cells
            if (/^\d/.test(cell) || /^[0-9.\-\/]+$/.test(cell) || cell.length < 2) continue;
            if (/^(유효성분|첨가제|원료약품|성분명|분량|단위|규격|비고|총량|발현부위)/.test(cell)) continue;
            
            const koMatch = cell.match(/([가-힣]{2,})/);
            const enMatch = cell.match(/([A-Za-z][A-Za-z\s\-]{2,})/);
            if (koMatch || enMatch) {
              console.log(`Detail page ingredient found: ${cell}`);
              return {
                nameKo: koMatch ? koMatch[1] : null,
                nameEn: enMatch ? enMatch[1].trim() : null,
                productName: fullProductName,
              };
            }
          }
        }
        
        // Broader fallback: look for 주성분/유효성분 text patterns
        const broadPatterns = [
          /주성분[^<]*?[:：]\s*([가-힣A-Za-z][가-힣A-Za-z\s\-]+)/i,
          /유효성분[^<]*?[:：]\s*([가-힣A-Za-z][가-힣A-Za-z\s\-]+)/i,
        ];
        for (const pattern of broadPatterns) {
          const match = detailHtml.match(pattern);
          if (match) {
            const raw = match[1].trim();
            if (raw.length > 1 && !/발현부위/.test(raw)) {
              const koMatch = raw.match(/([가-힣]{2,})/);
              const enMatch = raw.match(/([A-Za-z][A-Za-z\s\-]{2,})/);
              return {
                nameKo: koMatch ? koMatch[1] : null,
                nameEn: enMatch ? enMatch[1].trim() : null,
                productName: fullProductName,
              };
            }
          }
        }
      }
    } catch (e) {
      console.error("Detail page fetch failed:", e);
    }
  }

  return null;
}

// Step 2: Search news articles DB for api_keywords matching the product name
async function newsArticleIngredientLookup(productName: string): Promise<{ nameKo: string | null; nameEn: string | null } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search articles whose title contains the product name
    const { data, error } = await supabase
      .from("news_articles")
      .select("api_keywords, title")
      .ilike("title", `%${productName}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      console.log(`No news articles found for product: ${productName}`);
      return null;
    }

    console.log(`Found ${data.length} news articles mentioning "${productName}"`);

    // Collect all api_keywords from matching articles, count frequency
    const kwCount = new Map<string, number>();
    for (const article of data) {
      for (const kw of (article.api_keywords || [])) {
        // Skip keywords that look like the product name itself
        if (kw.toLowerCase() === productName.toLowerCase()) continue;
        kwCount.set(kw, (kwCount.get(kw) || 0) + 1);
      }
    }

    if (kwCount.size === 0) return null;

    // Pick the most frequent keyword as the ingredient
    const sorted = [...kwCount.entries()].sort((a, b) => b[1] - a[1]);
    const topKw = sorted[0][0];
    console.log(`News articles suggest ingredient: "${topKw}" (appeared ${sorted[0][1]} times)`);

    const isKo = /[가-힣]/.test(topKw);
    return {
      nameKo: isKo ? topKw : null,
      nameEn: !isKo ? topKw : null,
    };
  } catch (e) {
    console.error("News article lookup error:", e);
    return null;
  }
}

// Combined lookup: MFDS first → news articles fallback
async function scrapeIngredientByProduct(productName: string) {
  // Run MFDS and news DB lookups in parallel
  const [mfdsResult, newsResult] = await Promise.all([
    mfdsIngredientLookup(productName),
    newsArticleIngredientLookup(productName),
  ]);

  // Prefer MFDS if it found a valid result
  if (mfdsResult && (mfdsResult.nameKo || mfdsResult.nameEn)) {
    console.log(`✅ MFDS ingredient: ${mfdsResult.nameKo || mfdsResult.nameEn}`);
    return mfdsResult;
  }

  // Fallback to news articles DB
  if (newsResult) {
    console.log(`✅ News DB ingredient: ${newsResult.nameKo || newsResult.nameEn}`);
    return { ...newsResult, productName };
  }

  console.log("No ingredient found from MFDS or news articles");
  return null;
}