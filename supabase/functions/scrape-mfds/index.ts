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
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

// HTML 태그 제거 및 텍스트 정리 함수
function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// DMF 검색 로직 (수정됨)
async function scrapeDmf(keyword: string) {
  // 실제 식약처 검색 폼 파라미터 적용
  const params = new URLSearchParams();
  params.set("searchYn", "Y");
  params.set("searchKeyword", keyword); // 성분명 검색어
  params.set("upperItemName", keyword); // 성분명 필드 중복 지정
  params.set("searchType", "0");
  params.set("cp", "1");

  // GET 방식 대신 식약처 검색 엔드포인트에 맞춤
  const url = `https://nedrug.mfds.go.kr/pbp/CCBAC03/getList?${params.toString()}`;
  console.log(`Fetching DMF from: ${url}`);

  try {
    const resp = await fetch(url, { 
      headers: {
        ...HEADERS,
        "Referer": "https://nedrug.mfds.go.kr/pbp/CCBAC03"
      }
    });

    if (!resp.ok) {
      console.error("DMF fetch failed:", resp.status);
      return [];
    }

    const html = await resp.text();
    return parseDmfHtml(html);
  } catch (err) {
    console.error("DMF scrape exception:", err);
    return [];
  }
}

function parseDmfHtml(html: string): any[] {
  const records: any[] = [];
  
  // tbody 추출
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return [];
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const rowHtml = rowMatch[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }
    
    // 데이터가 있는 행인지 확인 (순번이 숫자인지)
    if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
      records.push({
        targetDrug: cells[1] || "",      // 대상의약품
        registrationNo: cells[2] || "",  // 등록번호
        ingredientName: cells[3] || "",  // 성분명
        applicant: cells[4] || "",       // 신청인
        manufacturer: cells[5] || "",    // 제조소명
        manufacturerAddress: cells[6] || "", // 소재지
        country: cells[7] || "",         // 제조국가
        registrationDate: cells[8] || "",// 최초등록일자
      });
    }
  }
  
  return records.slice(0, 10);
}

// 제품 검색 로직 (기존 유지하되 헤더 보강)
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
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return [];

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
    const rowHtml = rowMatch[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cleanText(cellMatch[1]));
    }
    
    if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
      products.push({
        name: cells[1] || "",
        company: cells[3] || "",
        permitDate: cells[7] || "",
      });
    }
  }
  return products.slice(0, 10);
}
