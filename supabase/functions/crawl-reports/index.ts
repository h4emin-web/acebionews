import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://finance.naver.com/research/industry_list.naver?keyword=&brokerCode=&writeFromDate=&writeToDate=&searchType=upjong&upjong=%C1%A6%BE%E0&x=17&y=1";

function parseDate(dateStr: string): string {
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

  const trBlocks = html.split(/<tr[\s>]/gi);
  for (const block of trBlocks) {
    if (!block.includes('industry_read.naver')) continue;
    const tds: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(block)) !== null) {
      tds.push(tdMatch[1].trim());
    }
    if (tds.length < 5) continue;
    const sector = tds[0].replace(/<[^>]*>/g, "").trim();
    if (sector !== "제약") continue;
    const titleLinkMatch = tds[1].match(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleLinkMatch) continue;
    const reportUrl = titleLinkMatch[1].replace(/&amp;/g, "&").trim();
    const title = titleLinkMatch[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim();
    const broker = tds[2].replace(/<[^>]*>/g, "").trim();
    const pdfMatch = tds[3].match(/href="(https:\/\/stock\.pstatic\.net[^"]*)"/i);
    const pdfUrl = pdfMatch ? pdfMatch[1].trim() : null;
    const dateStr = tds[4].replace(/<[^>]*>/g, "").trim();
    const views = tds.length > 5 ? parseInt(tds[5].replace(/<[^>]*>/g, "").trim()) || 0 : 0;
    const fullReportUrl = reportUrl.startsWith("http") ? reportUrl : `https://finance.naver.com/research/${reportUrl.replace(/^\//, "")}`;
    if (title.length > 2) {
      reports.push({ title, broker, date: parseDate(dateStr), report_url: fullReportUrl, pdf_url: pdfUrl, views });
    }
  }
  return reports;
}

// Scrape the detail page of a report and extract text content
async function scrapeReportDetail(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://finance.naver.com/research/",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return "";
    const buffer = await resp.arrayBuffer();
    const html = new TextDecoder("euc-kr").decode(buffer);

    // Extract content from <td class="view_cnt">...</td>
    const bodyMatch = html.match(/class="view_cnt"[^>]*>([\s\S]*?)<\/td>/i);
    if (!bodyMatch) {
      console.log("No view_cnt found in detail page");
      return "";
    }

    let text = bodyMatch[1];
    // Convert <br> and block tags to newlines
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<\/p>/gi, "\n");
    text = text.replace(/<\/li>/gi, "\n");
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]*>/g, "");
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
    // Clean whitespace
    text = text.split("\n").map(l => l.trim()).filter(Boolean).join("\n").trim();
    return text;
  } catch (e) {
    console.error(`Error scraping detail: ${e}`);
    return "";
  }
}

// Summarize report content using Gemini
async function summarizeContent(title: string, content: string): Promise<string | null> {
  if (!content || content.length < 30) return null;
  
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_KEY) return content.slice(0, 500); // fallback: just truncate

  try {
    const prompt = `다음은 증권사 제약 산업분석 리포트입니다. 핵심 내용을 보기 좋게 정리해주세요.

규칙:
- 주요 내용을 구조적으로 정리 (핵심 요약, 주요 종목/이슈, 투자 의견 등)
- 이모지를 적절히 사용해서 가독성 높이기
- 줄바꿈으로 구분해서 보기 좋게
- 최대 300자 이내

제목: ${title}
내용:
${content.slice(0, 2000)}`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!resp.ok) {
      console.error(`Gemini error: ${resp.status}`);
      return content.slice(0, 300);
    }

    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || content.slice(0, 300);
  } catch (e) {
    console.error(`Summarize error: ${e}`);
    return content.slice(0, 300);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const maxPages = body.maxPages || 2;
    const summarizeExisting = body.summarizeExisting || false; // backfill summaries

    // --- Backfill mode: summarize reports that have no summary ---
    if (summarizeExisting) {
      const { data: noSummary } = await supabase
        .from("industry_reports")
        .select("id, title, report_url, summary")
        .is("summary", null)
        .order("date", { ascending: false })
        .limit(10); // process 10 at a time to avoid timeout

      let updated = 0;
      for (const report of noSummary || []) {
        console.log(`Summarizing: ${report.title}`);
        const content = await scrapeReportDetail(report.report_url);
        if (!content) continue;
        const summary = await summarizeContent(report.title, content);
        if (summary) {
          await supabase.from("industry_reports").update({ summary }).eq("id", report.id);
          updated++;
        }
        await new Promise(r => setTimeout(r, 500)); // rate limit
      }

      return new Response(
        JSON.stringify({ success: true, summarized: updated, remaining: (noSummary?.length || 0) - updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Normal mode: crawl new reports ---
    const allReports: any[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE_URL}&page=${page}`;
      console.log(`Fetching reports page ${page}`);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) break;
      const buffer = await resp.arrayBuffer();
      const html = new TextDecoder("euc-kr").decode(buffer);
      const reports = parseReportsPage(html);
      console.log(`Page ${page}: found ${reports.length} reports`);
      allReports.push(...reports);
      if (reports.length === 0) break;
      if (page < maxPages) await new Promise(r => setTimeout(r, 1000));
    }

    // For each new report, try to get summary from detail page
    const reportsWithSummary = [];
    for (const report of allReports) {
      // Check if already exists with summary
      const { data: existing } = await supabase
        .from("industry_reports")
        .select("id, summary")
        .eq("report_url", report.report_url)
        .maybeSingle();

      if (existing?.summary) {
        // Already has summary, just upsert metadata
        reportsWithSummary.push({ ...report, summary: existing.summary });
        continue;
      }

      console.log(`Scraping detail: ${report.title}`);
      const content = await scrapeReportDetail(report.report_url);
      const summary = content ? await summarizeContent(report.title, content) : null;
      reportsWithSummary.push({ ...report, summary });
      await new Promise(r => setTimeout(r, 300));
    }

    if (reportsWithSummary.length > 0) {
      const { error } = await supabase
        .from("industry_reports")
        .upsert(reportsWithSummary, { onConflict: "report_url" });
      if (error) throw error;
      console.log(`Upserted ${reportsWithSummary.length} reports with summaries`);
    }

    return new Response(
      JSON.stringify({ success: true, count: reportsWithSummary.length }),
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
