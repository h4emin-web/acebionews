import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REGULATORY_SOURCES = [
  { url: "https://nedrug.mfds.go.kr/pbp/CCBAC01", name: "의약품안전나라", source: "의약품안전나라", label: "의약품안전나라 (안전성 서한, 회수·폐기, 공문)" },
  { url: "https://www.fda.gov/drugs/drug-safety-and-availability", name: "FDA Safety", source: "FDA", label: "FDA Safety" },
  { url: "https://www.fda.gov/drugs/guidance-compliance-regulatory-information", name: "FDA Guidance", source: "FDA", label: "FDA Guidance" },
  { url: "https://www.fda.gov/drugs/new-drugs-fda-cders-new-molecular-entities-and-new-therapeutic-biological-products/novel-drug-approvals-2025", name: "FDA NDA", source: "FDA-NDA", label: "FDA NDA Approvals" },
  { url: "https://www.fda.gov/drugs/new-drugs-fda-cders-new-molecular-entities-and-new-therapeutic-biological-products/novel-drug-approvals-2026", name: "FDA NDA 2026", source: "FDA-NDA", label: "FDA NDA Approvals 2026" },
  { url: "https://www.centerwatch.com/clinical-trials/listings/recent-approvals", name: "CenterWatch", source: "FDA-Clinical", label: "FDA Clinical Trial Approvals" },
  { url: "https://www.fda.gov/drugs/development-approval-process-drugs", name: "FDA Development", source: "FDA-Clinical", label: "FDA Drug Development & Approval" },
];

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

    const results: any[] = [];

    for (const regSource of REGULATORY_SOURCES) {
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
          }),
        });

        if (!scrapeResp.ok) {
          console.error(`Failed to scrape ${regSource.label}: ${scrapeResp.status}`);
          continue;
        }

        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

        if (!markdown || markdown.length < 50) {
          console.log(`No content from ${regSource.label}`);
          continue;
        }

        const sourceTypeMap: Record<string, string> = {
          "의약품안전나라": "안전성 서한, 회수·폐기, 공문",
          FDA: "Safety, Guidance, Approval, Warning",
          "FDA-NDA": "NDA Approval, NDA Submission, NDA Review",
          "FDA-Clinical": "Phase 1, Phase 2, Phase 3, BLA, Clinical Hold, Clinical Approval",
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

CRITICAL RULES for related API extraction:
- ONLY extract actual chemical/pharmaceutical ingredient names (원료의약품명) that are manufactured and supplied as raw materials for drug production
- Examples of VALID API keywords: 메트포르민 (Metformin), 세마글루타이드 (Semaglutide), 암로디핀 (Amlodipine), 이부프로펜 (Ibuprofen)
- Examples of INVALID keywords: 조제 약물, compounded drugs, biologics, 백신, vaccine, GLP-1, exosome, 추출물, 톡신, general drug categories
- Do NOT include: drug categories, formulation types, biological products, natural extracts, mechanism names, receptor names
- Keywords MUST be in format: "한글명 (English Name)" e.g. "메트포르민 (Metformin)"
- If a notice does not mention any specific API ingredient name, set relatedApis to an empty array []
- Only include notices that have at least one valid API keyword

For each valid notice:
1. Translate title to Korean if needed
2. Classify type as one of: ${sourceTypeMap[regSource.source]}

Return at most 8 most recent/relevant notices. If no relevant API notices found, return empty array.`,
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
          continue;
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) continue;

        const parsed = JSON.parse(toolCall.function.arguments);
        const notices = parsed.notices || [];

        for (const notice of notices) {
          // Skip notices without valid API keywords
          if (!notice.relatedApis || notice.relatedApis.length === 0) continue;
          
          results.push({
            title: notice.title,
            date: notice.date || new Date().toISOString().split("T")[0],
            type: notice.type,
            source: regSource.source,
            url: notice.url || regSource.url,
            related_apis: notice.relatedApis,
          });
        }

        console.log(`Extracted ${notices.length} notices from ${regSource.label}`);
      } catch (err) {
        console.error(`Error processing ${regSource.label}:`, err);
      }
    }

    if (results.length > 0) {
      // Deduplicate
      const { data: existing } = await supabase
        .from("regulatory_notices")
        .select("title");
      const existingTitles = new Set((existing || []).map((e: any) => e.title));
      const newResults = results.filter((r) => !existingTitles.has(r.title));

      if (newResults.length > 0) {
        const { error } = await supabase.from("regulatory_notices").insert(newResults);
        if (error) {
          console.error("DB insert error:", error);
          throw error;
        }
      }
      console.log(`Inserted ${newResults.length} new notices (${results.length - newResults.length} duplicates skipped)`);
    }

    return new Response(
      JSON.stringify({ success: true, count: results.length }),
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
