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
      const { records, totalCount } = await scrapeDmf(keyword);
      return new Response(JSON.stringify({ success: true, dmfRecords: records, totalCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (type === "ingredient-lookup") {
      const result = await scrapeIngredientByProduct(keyword);
      return new Response(JSON.stringify({ success: true, ingredient: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const { products, totalCount } = await scrapeProducts(keyword);
      return new Response(JSON.stringify({ success: true, domesticProducts: products, totalCount }), {
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

// Check if any product result is actually relevant to the search keyword
function isRelevantProduct(product: any, keyword: string): boolean {
  const kw = keyword.toLowerCase().replace(/\s/g, "");
  if (kw.length < 2) return false;
  const fields = [
    product.name, product.nameEn, product.ingredient, product.ingredientEn,
  ].filter(Boolean).map((f: string) => f.toLowerCase().replace(/\s/g, ""));
  
  for (const field of fields) {
    if (field.includes(kw)) return true;
  }
  return false;
}

function isRelevantDmf(record: any, keyword: string): boolean {
  const kw = keyword.toLowerCase().replace(/\s/g, "");
  if (kw.length < 2) return false;
  const fields = [
    record.ingredientName,
    record.ingredientNameEn,
  ].filter(Boolean).map((f: string) => f.toLowerCase().replace(/\s/g, ""));
  
  for (const field of fields) {
    if (field.includes(kw) || kw.includes(field)) return true;
  }
  return false;
}

async function scrapeProducts(keyword: string) {
  const isEnglish = /^[a-zA-Z\s\-]+$/.test(keyword.trim());
  
  // Try multiple search strategies
  const searchStrategies: Record<string, string>[] = [];
  if (isEnglish) {
    searchStrategies.push({ ingrEngName: keyword });
  } else {
    searchStrategies.push({ ingrName1: keyword });
    const enMatch = keyword.match(/\(([^)]+)\)/);
    if (enMatch) {
      searchStrategies.push({ ingrEngName: enMatch[1].trim() });
    }
  }

  for (const strategy of searchStrategies) {
    const result = await scrapeProductsWithParams(strategy);
    if (result.totalCount > 0 && result.products.length > 0) {
      // Validate relevance - filter out irrelevant results
      const searchTerm = isEnglish ? keyword : keyword.replace(/\s*\([^)]*\)\s*/g, "").trim();
      const relevant = result.products.filter((p: any) => isRelevantProduct(p, searchTerm));
      if (relevant.length > 0) {
        return { products: relevant, totalCount: result.totalCount };
      }
    }
  }

  return { products: [], totalCount: 0 };
}

async function scrapeProductsWithParams(searchParams: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    params.set(key, val);
  }
  params.set("indutyClassCode", "A0");

  const allProducts: any[] = [];
  let totalCount = 0;
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    params.set("page", String(page));
    const url = `https://nedrug.mfds.go.kr/searchDrug?${params.toString()}`;
    console.log(`Fetching products page ${page}: ${url}`);

    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) {
      console.error("Product fetch failed:", resp.status);
      break;
    }

    const html = await resp.text();

    // Extract total count from first page
    if (page === 1) {
      const countMatch = html.match(/총\s*([\d,]+)\s*건/);
      totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;
      console.log(`Products total count: ${totalCount}`);
      if (totalCount === 0) break;
    }

    const pageProducts = parseProductsHtml(html, false);
    if (pageProducts.length === 0) break;
    allProducts.push(...pageProducts);

    // If we got all items, stop
    if (allProducts.length >= totalCount) break;
    page++;
  }

  console.log(`Total parsed products across ${page} pages: ${allProducts.length}`);
  return { products: allProducts, totalCount };
}

function parseProductsHtml(html: string, limit = true): any[] {
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
        ingredient: cells[11] || "",
        ingredientEn: cells[12] || "",
      });
    }
    if (limit && products.length >= 10) break;
  }

  console.log(`Parsed ${products.length} products`);
  return products;
}

async function scrapeDmf(keyword: string) {
  const isEnglish = /^[a-zA-Z\s\-]+$/.test(keyword.trim());
  
  // Try multiple search strategies
  const searchStrategies: Record<string, string>[] = [];
  if (isEnglish) {
    searchStrategies.push({ searchIngrEngName: keyword });
  } else {
    searchStrategies.push({ searchIngrKorName: keyword });
    const enMatch = keyword.match(/\(([^)]+)\)/);
    if (enMatch) {
      searchStrategies.push({ searchIngrEngName: enMatch[1].trim() });
    }
  }

  for (const strategy of searchStrategies) {
    const result = await scrapeDmfWithParams(strategy, keyword);
    if (result.totalCount > 0 && result.records.length > 0) {
      const searchTerm = isEnglish ? keyword : keyword.replace(/\s*\([^)]*\)\s*/g, "").trim();
      const relevant = result.records.filter((r: any) => isRelevantDmf(r, searchTerm));
      if (relevant.length > 0) {
        return { records: relevant, totalCount: relevant.length };
      }
      // If Korean name didn't match records but totalCount > 0, try English
      if (!isEnglish) {
        const enMatch = keyword.match(/\(([^)]+)\)/);
        if (enMatch) {
          const enRelevant = result.records.filter((r: any) => isRelevantDmf(r, enMatch[1].trim()));
          if (enRelevant.length > 0) {
            return { records: enRelevant, totalCount: enRelevant.length };
          }
        }
      }
      // Validation failed - don't return irrelevant results
      console.log(`DMF: ${result.records.length} records fetched but none matched keyword "${keyword}", returning empty`);
      return { records: [], totalCount: 0 };
    }
  }

  return { records: [], totalCount: 0 };
}

async function scrapeDmfWithParams(searchParams: Record<string, string>, keyword?: string) {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(searchParams)) {
    params.set(key, val);
  }

  const allRecords: any[] = [];
  let totalCount = 0;
  let page = 1;
  // If the search returns too many results, limit pages to avoid fetching irrelevant data
  let maxPages = 10;

  while (page <= maxPages) {
    params.set("page", String(page));
    const url = `https://nedrug.mfds.go.kr/pbp/CCBAC03/getList?${params.toString()}`;
    console.log(`Fetching DMF page ${page}: ${url}`);

    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) {
      console.error("DMF fetch failed:", resp.status);
      break;
    }

    const html = await resp.text();

    if (page === 1) {
      const countMatch = html.match(/총\s*([\d,]+)\s*건/);
      totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, ""), 10) : 0;
      console.log(`DMF total count: ${totalCount}`);
      if (totalCount === 0) break;
      // If total is very high, it's likely a broad/unrelated search - limit to 1 page for filtering
      if (totalCount > 200) {
        console.log(`DMF total too high (${totalCount}), limiting to 1 page for relevance check`);
        maxPages = 1;
      }
    }

    const pageRecords = parseDmfHtml(html, false);
    if (pageRecords.length === 0) break;
    allRecords.push(...pageRecords);

    if (allRecords.length >= totalCount) break;
    page++;
  }

  console.log(`Total parsed DMF records across ${page} pages: ${allRecords.length}`);
  return { records: allRecords, totalCount };
}

function parseDmfHtml(html: string, limit = true): any[] {
  const records: any[] = [];

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
    if (limit && records.length >= 10) break;
  }

  console.log(`Parsed ${records.length} DMF records`);
  return records;
}

// ------- Ingredient Lookup (product name → API ingredient) -------

// Strip cell labels like "제품명 ", "제품영문명 " from MFDS table cells
function stripCellLabel(text: string): string {
  return text
    .replace(/^(제품명|제품영문명|업체명|업체명\(영문\)|품목기준코드|허가번호|허가일|품목구분|취소\/취하구분|취소\/취하일자|주성분\/주원료|주성분|주성분영문명|첨가제|묶음의약품보기|e약은요보기|품목분류|전문의약품|완제\/원료구분|허가\/신고|제조\/수입|수입제조국|마약구분|신약구분|표준코드|ATC코드)\s*/g, "")
    .trim();
}

// Simple string similarity: count matching characters
function similarity(a: string, b: string): number {
  const la = a.toLowerCase().replace(/\s/g, "");
  const lb = b.toLowerCase().replace(/\s/g, "");
  if (la === lb) return 1;
  // Check if one contains the other
  if (la.includes(lb) || lb.includes(la)) return 0.8;
  // Count common characters in order (LCS-like)
  let matches = 0;
  let j = 0;
  for (let i = 0; i < la.length && j < lb.length; i++) {
    if (la[i] === lb[j]) { matches++; j++; }
  }
  return matches / Math.max(la.length, lb.length);
}

// Extract all product rows from MFDS search result HTML
function parseAllProductRows(html: string): Array<{ cells: string[]; rowHtml: string }> {
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];

  const tbody = tbodyMatch[1];
  // Replace nested tables with their text content (preserving ingredient info)
  const cleanTbody = tbody.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
    return stripHtml(match);
  });

  const rows: Array<{ cells: string[]; rowHtml: string }> = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(cleanTbody)) !== null && rows.length < 30) {
    const rawCells = extractCells(rowMatch[1]);
    const cells = rawCells.map(stripCellLabel);
    if (cells.length >= 3 && /^\d+$/.test(cells[0])) {
      rows.push({ cells, rowHtml: rowMatch[1] });
    }
  }
  return rows;
}

// Pick the best matching product row for the search term
function findBestMatch(rows: Array<{ cells: string[]; rowHtml: string }>, searchTerm: string): { cells: string[]; rowHtml: string } | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  // Strip common suffixes like "정", "캡슐" for matching
  const cleanSearch = searchTerm.replace(/[0-9\/밀리그램mg]+$/gi, "").trim();

  let bestRow = rows[0];
  let bestScore = -1;

  for (const row of rows) {
    const productName = row.cells[1] || "";
    // Extract base product name (before dosage info)
    const baseName = productName.replace(/[\d\/]+밀리그램.*$/g, "").replace(/\(.*\)/, "").trim();
    
    const score = similarity(cleanSearch, baseName);
    // Bonus: if product has ingredient in parentheses, it's more useful
    const hasIngredient = /\([가-힣a-zA-Z\s\-]+\)/.test(productName) ? 0.1 : 0;
    const totalScore = score + hasIngredient;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestRow = row;
    }
  }

  console.log(`Best match: "${bestRow.cells[1]}" (score: ${bestScore.toFixed(2)})`);
  return bestRow;
}

// Extract ingredient from a product row
// MFDS table columns: 0=순번, 1=제품명, 2=제품영문명, 3=업체명, ..., 11=주성분/주원료, 12=주성분영문명
function extractIngredientFromRow(row: { cells: string[]; rowHtml: string }): { nameKo: string | null; nameEn: string | null; productName: string } | null {
  const fullProductName = row.cells[1] || "";

  // Direct column read: 주성분/주원료 (col 11), 주성분영문명 (col 12)
  const mainIngredient = row.cells[11]?.trim() || "";
  const mainIngredientEn = row.cells[12]?.trim() || "";

  if (mainIngredient || mainIngredientEn) {
    // Clean up: ingredient column may have dosage info like "니세르골린 5mg"
    const koMatch = mainIngredient.match(/([가-힣]{2,}[가-힣a-zA-Z]*)/);
    const enMatch = mainIngredientEn.match(/([A-Za-z][A-Za-z\s\-]{2,})/);
    const nameKo = koMatch ? koMatch[1].trim() : null;
    const nameEn = enMatch ? enMatch[1].trim() : null;
    
    if (nameKo || nameEn) {
      console.log(`From table columns: Ko="${nameKo}" En="${nameEn}"`);
      return { nameKo, nameEn, productName: fullProductName };
    }
  }

  // Fallback: try extracting from parentheses in product name
  const ingredientFromName = fullProductName.match(/\(([가-힣a-zA-Z\s\-]+)\)/);
  if (ingredientFromName) {
    const nameKo = ingredientFromName[1].trim();
    const nameEn = row.cells[2]?.match(/\(([A-Za-z\s\-]+)\)/)?.[1]?.trim() || null;
    console.log(`From name parentheses: ${nameKo}`);
    return { nameKo, nameEn, productName: fullProductName };
  }

  console.log(`Could not extract ingredient from row: "${fullProductName}"`);
  return null;
}

// Main MFDS ingredient lookup — tries exact search, then partial search
async function mfdsIngredientLookup(productName: string): Promise<{ nameKo: string | null; nameEn: string | null; productName: string } | null> {
  // Step 1: Exact search
  const exactUrl = `https://nedrug.mfds.go.kr/searchDrug?itemName=${encodeURIComponent(productName)}`;
  console.log(`MFDS exact search: ${exactUrl}`);

  const exactResp = await fetch(exactUrl, { headers: HEADERS });
  if (exactResp.ok) {
    const exactHtml = await exactResp.text();
    const exactRows = parseAllProductRows(exactHtml);
    
    if (exactRows.length > 0) {
      console.log(`Exact search found ${exactRows.length} results`);
      const bestRow = findBestMatch(exactRows, productName);
      if (bestRow) {
        const result = extractIngredientFromRow(bestRow);
        if (result) return result;
      }
    }
  }

  // Step 2: Partial search — strip trailing "정", "캡슐", "정제" etc. and retry
  const partialName = productName
    .replace(/(정|캡슐|정제|산|액|시럽|주사|주|크림|겔|연고|패치|필름코팅정|서방정|츄어블정)$/g, "")
    .trim();

  if (partialName !== productName && partialName.length >= 2) {
    const partialUrl = `https://nedrug.mfds.go.kr/searchDrug?itemName=${encodeURIComponent(partialName)}`;
    console.log(`MFDS partial search: ${partialUrl}`);

    const partialResp = await fetch(partialUrl, { headers: HEADERS });
    if (partialResp.ok) {
      const partialHtml = await partialResp.text();
      const partialRows = parseAllProductRows(partialHtml);

      if (partialRows.length > 0) {
        console.log(`Partial search found ${partialRows.length} results`);
        const bestRow = findBestMatch(partialRows, productName);
        if (bestRow) {
          const result = extractIngredientFromRow(bestRow);
          if (result) return result;
        }
      }
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