import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper to call Gemini API
async function callGemini(GEMINI_KEY: string, systemPrompt: string, userPrompt: string): Promise<any[]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!resp.ok) {
    console.error(`Gemini API error: ${resp.status}`);
    return [];
  }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.notices || parsed.alerts || [];
  } catch {
    // Try to extract JSON array from text
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

// Fetch FDA Drug Alerts & Statements via Firecrawl
async function fetchFdaAlerts(GEMINI_KEY: string, FIRECRAWL_API_KEY: string) {
  if (!FIRECRAWL_API_KEY) {
    console.log("Skipping FDA alerts: no Firecrawl key");
    return [];
  }
  try {
    const url = "https://www.fda.gov/drugs/drug-safety-and-availability/drug-alerts-and-statements";
    console.log(`Fetching FDA Alerts via Firecrawl: ${url}`);
    
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 20000,
      }),
    });
    
    if (!scrapeResp.ok) {
      console.error(`Firecrawl FDA scrape failed: ${scrapeResp.status}`);
      return [];
    }
    
    const scrapeData = await scrapeResp.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    console.log(`FDA markdown length: ${markdown.length}`);
    if (!markdown || markdown.length < 50) return [];
    
    const notices = await callGemini(
      GEMINI_KEY,
      `You extract FDA drug alerts AND statements from a page that has TWO separate tables.

The page has:
1. An "Alerts" section with a table of alerts (warnings, recalls, safety alerts)
2. A "Statements" section with a table of statements

You MUST extract items from BOTH tables. Extract up to 5 from Alerts and up to 5 from Statements.

For each item:
1. "title": Korean translated summary (e.g. "FDA, [약물명] 관련 안전성 경고 - [구체적 내용]" or "FDA, [내용] 발표")
2. "date": date in YYYY-MM-DD format (convert M/D/YYYY to YYYY-MM-DD)
3. "type": "Safety Alert" for items from Alerts table, "Statement" for items from Statements table
4. "url": the full FDA URL from the link
5. "relatedApis": array of related API ingredient names in format "한글명 (English Name)", or empty array if none

IMPORTANT: Each item must have a UNIQUE title. Do not create duplicates.
Return a JSON array.`,
      `Extract FDA Drug Alerts AND Statements from both tables:\n\n${markdown.slice(0, 10000)}`
    );
    
    const results = notices.slice(0, 10).map((n: any) => ({
      title: n.title || "",
      date: normalizeDate(n.date),
      type: n.type || "Safety Alert",
      source: "FDA",
      url: n.url || url,
      related_apis: n.relatedApis || [],
    })).filter((n: any) => n.title.length > 5);
    
    console.log(`FDA Alerts: extracted ${results.length} notices`);
    return results;
  } catch (err) {
    console.error("Error fetching FDA alerts:", err);
    return [];
  }
}

// Crawl 의약품안전나라 via Firecrawl
async function crawlMfdsNotices(FIRECRAWL_API_KEY: string, GEMINI_KEY: string) {
  try {
    const url = "https://nedrug.mfds.go.kr/pbp/CCBAC01";
    console.log(`Crawling 의약품안전나라: ${url}`);
    
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (!scrapeResp.ok) {
      console.error(`Failed to scrape 의약품안전나라: ${scrapeResp.status}`);
      return [];
    }

    const scrapeData = await scrapeResp.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    if (!markdown || markdown.length < 50) return [];

    const notices = await callGemini(
      GEMINI_KEY,
      `You extract regulatory notices from Korean pharmaceutical safety authority (의약품안전나라).

For each notice:
1. "title": the notice title in Korean
2. "date": date in YYYY-MM-DD format
3. "type": one of "안전성 서한", "회수·폐기", "공문"
4. "url": URL if available
5. "relatedApis": array of related API ingredient names in format "한글명 (English Name)"

Return a JSON array. Only include items with identifiable pharmaceutical ingredient names.`,
      `Extract regulatory notices:\n\n${markdown.slice(0, 6000)}`
    );

    const results = notices
      .filter((n: any) => n.relatedApis && n.relatedApis.length > 0)
      .map((n: any) => ({
        title: n.title || "",
        date: normalizeDate(n.date),
        type: n.type || "공문",
        source: "의약품안전나라",
        url: n.url || url,
        related_apis: n.relatedApis,
      }));

    console.log(`의약품안전나라: extracted ${results.length} notices`);
    return results;
  } catch (err) {
    console.error("Error crawling 의약품안전나라:", err);
    return [];
  }
}

// Fetch FDA NDA approvals from openFDA API
async function fetchFdaNdaApprovals(GEMINI_KEY: string) {
  try {
    const url = `https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_type:"ORIG"&sort=submissions.submission_status_date:desc&limit=15`;
    console.log(`Fetching FDA NDA data`);

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      console.error(`openFDA API error: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const results = data.results || [];
    console.log(`openFDA returned ${results.length} results`);
    if (results.length === 0) return [];

    const summaries = results.slice(0, 10).map((r: any) => {
      const products = (r.products || []).map((p: any) =>
        `${p.brand_name || ""} (${p.active_ingredients?.map((a: any) => a.name).join(", ") || "unknown"})`
      ).join("; ");
      const submission = (r.submissions || []).find((s: any) => s.submission_type === "ORIG");
      const date = submission?.submission_status_date || "";
      const formattedDate = date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : "";
      const appNum = r.application_number || "";
      return `Drug: ${r.sponsor_name || ""} - ${products} | NDA: ${appNum} | Date: ${formattedDate} | Status: ${submission?.submission_status || ""}`;
    }).join("\n");

    const notices = await callGemini(
      GEMINI_KEY,
      `You convert FDA drug approval data into Korean regulatory notices.

For each drug approval:
1. "title": Korean title (e.g. "FDA, [한글 약물명] NDA 승인 - [적응증]")
2. "date": YYYY-MM-DD format
3. "type": "NDA Approval" or "NDA Submission"
4. "url": "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=" + NDA number (digits only)
5. "relatedApis": array with API in format "한글명 (English Name)"

Return JSON array. ONLY include entries with identifiable chemical API ingredients. Skip biologics, vaccines.`,
      `Convert these FDA approvals:\n\n${summaries}`
    );

    const results2 = notices
      .filter((n: any) => n.relatedApis && n.relatedApis.length > 0)
      .map((n: any) => ({
        title: n.title,
        date: normalizeDate(n.date),
        type: n.type || "NDA Approval",
        source: "FDA-NDA",
        url: n.url || "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm",
        related_apis: n.relatedApis,
      }));
    console.log(`FDA NDA: extracted ${results2.length} notices`);
    return results2;
  } catch (err) {
    console.error("Error fetching FDA NDA:", err);
    return [];
  }
}

// Fetch clinical trials from ClinicalTrials.gov API
async function fetchClinicalTrials(GEMINI_KEY: string) {
  try {
    const url = `https://clinicaltrials.gov/api/v2/studies?filter.overallStatus=COMPLETED&pageSize=15&sort=StudyFirstPostDate:desc`;
    console.log(`Fetching ClinicalTrials.gov data`);

    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      console.error(`ClinicalTrials.gov API error: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const studies = data.studies || [];
    console.log(`ClinicalTrials.gov returned ${studies.length} studies`);
    if (studies.length === 0) return [];

    const summaries = studies.slice(0, 10).map((s: any) => {
      const p = s.protocolSection || {};
      const id = p.identificationModule?.nctId || "";
      const title = p.identificationModule?.briefTitle || "";
      const phase = (p.designModule?.phases || []).join(", ");
      const interventions = (p.armsInterventionsModule?.interventions || [])
        .map((i: any) => `${i.name} (${i.type})`).join(", ");
      const conditions = (p.conditionsModule?.conditions || []).join(", ");
      return `NCT: ${id} | Title: ${title} | Phase: ${phase} | Interventions: ${interventions} | Conditions: ${conditions}`;
    }).join("\n");

    const notices = await callGemini(
      GEMINI_KEY,
      `You convert clinical trial data into Korean regulatory notices about API ingredients.

For each trial:
1. "title": Korean title (e.g. "[API명] Phase 3 임상시험 완료 - [적응증]")
2. "date": YYYY-MM-DD format  
3. "type": phase + result (e.g. "Phase 3 완료")
4. "url": "https://clinicaltrials.gov/study/" + NCTId
5. "relatedApis": array with API in format "한글명 (English Name)"

Return JSON array. ONLY include trials with identifiable chemical API ingredients. Skip biologics, vaccines, devices, behavioral interventions.`,
      `Convert these clinical trials:\n\n${summaries}`
    );

    const results = notices
      .filter((n: any) => n.relatedApis && n.relatedApis.length > 0)
      .map((n: any) => ({
        title: n.title,
        date: normalizeDate(n.date),
        type: n.type || "Clinical",
        source: "FDA-Clinical",
        url: n.url || "https://clinicaltrials.gov",
        related_apis: n.relatedApis,
      }));
    console.log(`Clinical: extracted ${results.length} notices`);
    return results;
  } catch (err) {
    console.error("Error fetching clinical trials:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run all data fetching in parallel
    const [fdaAlerts, mfdsResults, ndaResults, clinicalResults] = await Promise.all([
      fetchFdaAlerts(GEMINI_KEY, FIRECRAWL_API_KEY),
      FIRECRAWL_API_KEY ? crawlMfdsNotices(FIRECRAWL_API_KEY, GEMINI_KEY) : Promise.resolve([]),
      fetchFdaNdaApprovals(GEMINI_KEY),
      fetchClinicalTrials(GEMINI_KEY),
    ]);

    const allResults = [...fdaAlerts, ...mfdsResults, ...ndaResults, ...clinicalResults];
    console.log(`Total results: fdaAlerts=${fdaAlerts.length}, mfds=${mfdsResults.length}, nda=${ndaResults.length}, clinical=${clinicalResults.length}`);

    if (allResults.length > 0) {
      // Dedup by URL (primary) and title (secondary)
      const { data: existing } = await supabase
        .from("regulatory_notices")
        .select("url, title");
      const existingUrls = new Set((existing || []).map((e: any) => e.url));
      const existingTitles = new Set((existing || []).map((e: any) => e.title));
      const newResults = allResults.filter((r) => !existingUrls.has(r.url) && !existingTitles.has(r.title));

      if (newResults.length > 0) {
        const { error } = await supabase.from("regulatory_notices").insert(newResults);
        if (error) {
          console.error("DB insert error:", error);
          throw error;
        }
      }
      console.log(`Inserted ${newResults.length} new notices (${allResults.length - newResults.length} duplicates skipped)`);
    }

    return new Response(
      JSON.stringify({ success: true, fdaAlerts: fdaAlerts.length, mfds: mfdsResults.length, nda: ndaResults.length, clinical: clinicalResults.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-regulatory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
