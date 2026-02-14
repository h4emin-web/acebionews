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

const REGULATORY_SOURCES = [
  { url: "https://nedrug.mfds.go.kr/pbp/CCBAC01", name: "의약품안전나라", source: "의약품안전나라", label: "의약품안전나라 (안전성 서한, 회수·폐기, 공문)" },
  { url: "https://www.fda.gov/drugs/drug-safety-and-availability", name: "FDA Safety", source: "FDA", label: "FDA Safety" },
  { url: "https://www.fda.gov/drugs/guidance-compliance-regulatory-information", name: "FDA Guidance", source: "FDA", label: "FDA Guidance" },
  // NDA - use drugwatch and drugs.com which are more reliable
  { url: "https://www.drugs.com/newdrugs.html", name: "Drugs.com NDA", source: "FDA-NDA", label: "FDA New Drug Approvals" },
  { url: "https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm", name: "FDA DAF", source: "FDA-NDA", label: "FDA Drug Approval Reports" },
  // Clinical trials
  { url: "https://www.centerwatch.com/clinical-trials/results", name: "CenterWatch Results", source: "FDA-Clinical", label: "Clinical Trial Results" },
  { url: "https://www.biopharmadive.com/topic/clinical-trials/", name: "BioPharma Dive", source: "FDA-Clinical", label: "BioPharma Clinical Trials" },
];

async function crawlRegSource(
  regSource: typeof REGULATORY_SOURCES[0],
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

    if (!markdown || markdown.length < 50) {
      console.log(`No content from ${regSource.label}`);
      return [];
    }

    const sourceTypeMap: Record<string, string> = {
      "의약품안전나라": "안전성 서한, 회수·폐기, 공문",
      FDA: "Safety, Guidance, Approval, Warning",
      "FDA-NDA": "NDA Approval, NDA Submission, NDA Review",
      "FDA-Clinical": "Phase 1, Phase 2, Phase 3, BLA, Clinical Hold, Clinical Approval",
    };

    const clinicalExtra = regSource.source === "FDA-Clinical"
      ? `\nIMPORTANT: For clinical trial results, always specify the phase (Phase 1, Phase 2, Phase 3, BLA) in the type field. If a trial was successful/approved, prefix with "Phase X 성공" or "Phase X 승인". Example types: "Phase 3 성공", "Phase 2 승인", "BLA 승인".`
      : "";

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
- Only include notices with at least one valid API keyword${clinicalExtra}

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

    if (!aiResp.ok) {
      console.error(`AI failed for ${regSource.label}: ${aiResp.status}`);
      return [];
    }

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

    // Crawl all sources in parallel (batches of 3)
    const batchSize = 3;
    const allResults: any[] = [];
    for (let i = 0; i < REGULATORY_SOURCES.length; i += batchSize) {
      const batch = REGULATORY_SOURCES.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((s) => crawlRegSource(s, FIRECRAWL_API_KEY, LOVABLE_API_KEY))
      );
      allResults.push(...batchResults.flat());
    }

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
