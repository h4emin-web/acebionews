import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Only scrape-based sources (MFDS, FDA safety/guidance)
const SCRAPE_SOURCES = [
  { url: "https://nedrug.mfds.go.kr/pbp/CCBAC01", name: "의약품안전나라", source: "의약품안전나라", label: "의약품안전나라 (안전성 서한, 회수·폐기, 공문)" },
  { url: "https://www.fda.gov/drugs/drug-safety-and-availability", name: "FDA Safety", source: "FDA", label: "FDA Safety" },
  { url: "https://www.fda.gov/drugs/guidance-compliance-regulatory-information", name: "FDA Guidance", source: "FDA", label: "FDA Guidance" },
];

async function crawlScrapeSource(
  regSource: typeof SCRAPE_SOURCES[0],
  FIRECRAWL_API_KEY: string,
  LOVABLE_API_KEY: string
) {
  try {
    console.log(`Crawling ${regSource.label}: ${regSource.url}`);
    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: regSource.url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 15000,
      }),
    });

    if (!scrapeResp.ok) {
      console.error(`Failed to scrape ${regSource.label}: ${scrapeResp.status}`);
      return [];
    }

    const scrapeData = await scrapeResp.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

    if (!markdown || markdown.length < 50) return [];

    const sourceTypeMap: Record<string, string> = {
      "의약품안전나라": "안전성 서한, 회수·폐기, 공문",
      FDA: "Safety, Guidance, Approval, Warning",
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You extract regulatory notices related to Active Pharmaceutical Ingredients (APIs/원료의약품).

CRITICAL RULES:
- ONLY extract actual chemical/pharmaceutical ingredient names
- Keywords MUST be in format: "한글명 (English Name)"
- If no specific API ingredient name, set relatedApis to []
- Only include notices with at least one valid API keyword

For each notice:
1. Translate title to Korean if needed
2. Classify type as one of: ${sourceTypeMap[regSource.source]}

Return at most 8 most recent/relevant notices.`,
          },
          {
            role: "user",
            content: `Extract regulatory notices from ${regSource.label}:\n\n${markdown.slice(0, 6000)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_notices",
              description: "Extract regulatory notices",
              parameters: {
                type: "object",
                properties: {
                  notices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        date: { type: "string" },
                        type: { type: "string" },
                        url: { type: "string" },
                        relatedApis: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "date", "type", "relatedApis"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["notices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_notices" } },
      }),
    });

    if (!aiResp.ok) return [];

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const notices = parsed.notices || [];

    const results = [];
    for (const notice of notices) {
      if (!notice.relatedApis || notice.relatedApis.length === 0) continue;
      results.push({
        title: notice.title,
        date: normalizeDate(notice.date),
        type: notice.type,
        source: regSource.source,
        url: notice.url || regSource.url,
        related_apis: notice.relatedApis,
      });
    }

    console.log(`Extracted ${results.length} notices from ${regSource.label}`);
    return results;
  } catch (err) {
    console.error(`Error processing ${regSource.label}:`, err);
    return [];
  }
}

// Fetch FDA NDA approvals from openFDA API
async function fetchFdaNdaApprovals(LOVABLE_API_KEY: string) {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().split("T")[0].replace(/-/g, "");
    const toDate = new Date().toISOString().split("T")[0].replace(/-/g, "");

    const url = `https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_type:%22ORIG%22+AND+submissions.submission_status_date:[${fromDate}+TO+${toDate}]&limit=20`;
    console.log(`Fetching FDA NDA data: ${url}`);

    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`openFDA API error: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) return [];

    // Build a summary for AI to extract API keywords
    const summaries = results.map((r: any) => {
      const products = (r.products || []).map((p: any) =>
        `${p.brand_name || ""} (${p.active_ingredients?.map((a: any) => a.name).join(", ") || "unknown"})`
      ).join("; ");
      const submission = (r.submissions || []).find((s: any) => s.submission_type === "ORIG");
      const date = submission?.submission_status_date || "";
      const formattedDate = date ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : "";
      return `Drug: ${r.sponsor_name || ""} - ${products} | NDA: ${r.application_number || ""} | Date: ${formattedDate} | Status: ${submission?.submission_status || ""}`;
    }).join("\n");

    // Use AI to format into proper notices with Korean API keywords
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You convert FDA drug approval data into Korean regulatory notices.

For each drug approval:
1. Create a Korean title describing the approval (e.g. "FDA, [한글 약물명] NDA 승인 - [적응증]")
2. Extract the active pharmaceutical ingredient (API) name in format "한글명 (English Name)"
3. Set type to "NDA Approval" or "NDA Submission" based on status
4. Use the date from the data (YYYY-MM-DD format)

ONLY include entries where you can identify a specific chemical API ingredient name.
Skip biological products, vaccines, or combination products without clear API ingredients.`,
          },
          {
            role: "user",
            content: `Convert these FDA approvals:\n\n${summaries}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_notices",
              description: "Extract formatted notices",
              parameters: {
                type: "object",
                properties: {
                  notices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        date: { type: "string" },
                        type: { type: "string" },
                        url: { type: "string" },
                        relatedApis: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "date", "type", "relatedApis"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["notices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_notices" } },
      }),
    });

    if (!aiResp.ok) return [];
    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    return (parsed.notices || [])
      .filter((n: any) => n.relatedApis && n.relatedApis.length > 0)
      .map((n: any) => ({
        title: n.title,
        date: normalizeDate(n.date),
        type: n.type || "NDA Approval",
        source: "FDA-NDA",
        url: n.url || "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm",
        related_apis: n.relatedApis,
      }));
  } catch (err) {
    console.error("Error fetching FDA NDA:", err);
    return [];
  }
}

// Fetch clinical trial results from ClinicalTrials.gov API
async function fetchClinicalTrials(LOVABLE_API_KEY: string) {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const fromDate = sixMonthsAgo.toISOString().split("T")[0];

    const url = `https://clinicaltrials.gov/api/v2/studies?filter.overallStatus=COMPLETED&filter.advanced=AREA[ResultsFirstPostDate]RANGE[${fromDate},MAX]&pageSize=20&fields=NCTId,BriefTitle,Phase,Condition,InterventionName,ResultsFirstPostDate,OverallStatus&sort=ResultsFirstPostDate:desc`;
    console.log(`Fetching ClinicalTrials.gov data`);

    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`ClinicalTrials.gov API error: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const studies = data.studies || [];
    if (studies.length === 0) return [];

    const summaries = studies.map((s: any) => {
      const p = s.protocolSection || {};
      const id = p.identificationModule?.nctId || "";
      const title = p.identificationModule?.briefTitle || "";
      const phase = (p.designModule?.phases || []).join(", ");
      const interventions = (p.armsInterventionsModule?.interventions || [])
        .map((i: any) => i.name).join(", ");
      const date = p.statusModule?.resultsFirstPostDateStruct?.date || "";
      return `NCT: ${id} | Title: ${title} | Phase: ${phase} | Interventions: ${interventions} | Date: ${date}`;
    }).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You convert clinical trial data into Korean regulatory notices about API ingredients.

For each trial:
1. Create Korean title (e.g. "[API명] Phase 3 임상시험 완료 - [적응증]")
2. Extract the active pharmaceutical ingredient in format "한글명 (English Name)"
3. Set type to the phase + result (e.g. "Phase 3 성공", "Phase 2 완료", "Phase 1 완료")
4. Date in YYYY-MM-DD format

ONLY include trials with identifiable chemical API ingredients. Skip biologics, vaccines, devices.`,
          },
          {
            role: "user",
            content: `Convert these clinical trials:\n\n${summaries}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_notices",
              description: "Extract formatted notices",
              parameters: {
                type: "object",
                properties: {
                  notices: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        date: { type: "string" },
                        type: { type: "string" },
                        url: { type: "string" },
                        relatedApis: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "date", "type", "relatedApis"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["notices"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_notices" } },
      }),
    });

    if (!aiResp.ok) return [];
    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    return (parsed.notices || [])
      .filter((n: any) => n.relatedApis && n.relatedApis.length > 0)
      .map((n: any) => ({
        title: n.title,
        date: normalizeDate(n.date),
        type: n.type || "Clinical",
        source: "FDA-Clinical",
        url: n.url || "https://clinicaltrials.gov",
        related_apis: n.relatedApis,
      }));
  } catch (err) {
    console.error("Error fetching clinical trials:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run all data fetching in parallel
    const [scrapeResults, ndaResults, clinicalResults] = await Promise.all([
      // Scrape-based sources in parallel
      Promise.all(SCRAPE_SOURCES.map((s) => crawlScrapeSource(s, FIRECRAWL_API_KEY, LOVABLE_API_KEY))).then((r) => r.flat()),
      // FDA NDA from openFDA API
      fetchFdaNdaApprovals(LOVABLE_API_KEY),
      // Clinical trials from ClinicalTrials.gov API
      fetchClinicalTrials(LOVABLE_API_KEY),
    ]);

    const allResults = [...scrapeResults, ...ndaResults, ...clinicalResults];

    if (allResults.length > 0) {
      const { data: existing } = await supabase
        .from("regulatory_notices")
        .select("title");
      const existingTitles = new Set((existing || []).map((e: any) => e.title));
      const newResults = allResults.filter((r) => !existingTitles.has(r.title));

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
      JSON.stringify({ success: true, count: allResults.length }),
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
