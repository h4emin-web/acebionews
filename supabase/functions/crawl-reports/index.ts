import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://finance.naver.com/research/industry_list.naver?keyword=&brokerCode=&writeFromDate=&writeToDate=&searchType=upjong&upjong=%C1%A6%BE%E0&x=17&y=1";

function parseDate(dateStr: string): string {
  // Format: "26.02.09" -> "2026-02-09"
  const match = dateStr.trim().match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (match) {
    const year = parseInt(match[1]) + 2000;
    return `${year}-${match[2]}-${match[3]}`;
  }
  return new Date().toISOString().split("T")[0];
}

function parseReportsPage(html: string): Array<{
  title: string;
  broker: string;
  date: string;
  report_url: string;
  pdf_url: string | null;
  views: number;
}> {
  const reports: Array<{
    title: string;
    broker: string;
    date: string;
    report_url: string;
    pdf_url: string | null;
    views: number;
  }> = [];

  // Use a simpler approach: find all industry_read links
  const trBlocks = html.split(/<tr[\s>]/gi);
  console.log(`Found ${trBlocks.length} TR blocks`);
  
  for (const block of trBlocks) {
    // Must have industry_read link
    if (!block.includes('industry_read.naver')) continue;
    
    // Extract all <td> contents
    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(block)) !== null) {
      tds.push(tdMatch[1].trim());
    }
    
    if (tds.length < 5) continue;
    
    // td[0] = sector (제약)
    const sector = tds[0].replace(/<[^>]*>/g, "").trim();
    if (sector !== "제약") continue;
    
    // td[1] = title with link
    const titleLinkMatch = tds[1].match(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleLinkMatch) continue;
    const reportUrl = titleLinkMatch[1].replace(/&amp;/g, "&").trim();
    const title = titleLinkMatch[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();
    
    // td[2] = broker
    const broker = tds[2].replace(/<[^>]*>/g, "").trim();
    
    // td[3] = pdf file
    const pdfMatch = tds[3].match(/href="(https:\/\/stock\.pstatic\.net[^"]*)"/i);
    const pdfUrl = pdfMatch ? pdfMatch[1].trim() : null;
    
    // td[4] = date
    const dateStr = tds[4].replace(/<[^>]*>/g, "").trim();
    
    // td[5] = views
    const views = tds.length > 5 ? parseInt(tds[5].replace(/<[^>]*>/g, "").trim()) || 0 : 0;

    const fullReportUrl = reportUrl.startsWith("http")
      ? reportUrl
      : `https://finance.naver.com${reportUrl}`;

    if (title.length > 2) {
      reports.push({
        title,
        broker,
        date: parseDate(dateStr),
        report_url: fullReportUrl,
        pdf_url: pdfUrl,
        views,
      });
    }
  }

  return reports;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const maxPages = body.maxPages || 2; // Default 2 pages, pass more for backfill

    const allReports: any[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE_URL}&page=${page}`;
      console.log(`Fetching reports page ${page}: ${url}`);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        console.error(`Page ${page} fetch failed: ${resp.status}`);
        break;
      }

      // Naver Finance uses EUC-KR encoding
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder("euc-kr");
      const html = decoder.decode(buffer);
      console.log(`Page ${page} HTML length: ${html.length}, contains 제약: ${html.includes("제약")}`);
      const reports = parseReportsPage(html);
      console.log(`Page ${page}: found ${reports.length} reports`);
      allReports.push(...reports);

      if (reports.length === 0) break;
      if (page < maxPages) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (allReports.length > 0) {
      // Upsert to handle duplicates
      const { error } = await supabase
        .from("industry_reports")
        .upsert(allReports, { onConflict: "report_url" });

      if (error) {
        console.error("DB upsert error:", error);
        throw error;
      }
      console.log(`Upserted ${allReports.length} reports`);
    }

    return new Response(
      JSON.stringify({ success: true, count: allReports.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-reports error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
