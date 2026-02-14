import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REGULATORY_SOURCES = [
  { url: "https://www.mfds.go.kr/brd/m_74/list.do", name: "MFDS", source: "MFDS", label: "식약처 공문" },
  { url: "https://www.mfds.go.kr/brd/m_99/list.do", name: "MFDS공지", source: "MFDS", label: "식약처 공지사항" },
  { url: "https://nedrug.mfds.go.kr/pbp/CCBBB01/getList", name: "의약품안전나라", source: "의약품안전나라", label: "의약품안전나라" },
  { url: "https://www.fda.gov/drugs/drug-safety-and-availability", name: "FDA Safety", source: "FDA", label: "FDA Safety" },
  { url: "https://www.fda.gov/drugs/guidance-compliance-regulatory-information", name: "FDA Guidance", source: "FDA", label: "FDA Guidance" },
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
          MFDS: "공문, 공지사항, 행정예고, 허가",
          "의약품안전나라": "안전성정보, 허가변경, 회수·판매중지, 부작용",
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
                content: `You extract regulatory notices related to pharmaceuticals and APIs (원료의약품).
For each notice:
1. Translate title to Korean if needed
2. Extract related API/원료의약품 names as keywords (in Korean)
3. Classify type as one of: ${sourceTypeMap[regSource.source]}

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
          continue;
        }

        const aiData = await aiResp.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) continue;

        const parsed = JSON.parse(toolCall.function.arguments);
        const notices = parsed.notices || [];

        for (const notice of notices) {
          results.push({
            title: notice.title,
            date: notice.date || new Date().toISOString().split("T")[0],
            type: notice.type,
            source: regSource.source,
            url: notice.url || regSource.url,
            related_apis: notice.relatedApis || [],
          });
        }

        console.log(`Extracted ${notices.length} notices from ${regSource.label}`);
      } catch (err) {
        console.error(`Error processing ${regSource.label}:`, err);
      }
    }

    if (results.length > 0) {
      const { error } = await supabase.from("regulatory_notices").insert(results);
      if (error) {
        console.error("DB insert error:", error);
        throw error;
      }
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
