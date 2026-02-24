const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword } = await req.json();
    if (!keyword || keyword.trim().length < 2) {
      return new Response(JSON.stringify({ manufacturers: { india: [], china: [], global: [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    // Extract English name from "한글명 (EnglishName)" format
    const enMatch = keyword.match(/\(([^)]+)\)/);
    const koMatch = keyword.match(/^([가-힣\s]+)/);
    const englishName = enMatch ? enMatch[1].trim() : null;
    const koreanName = koMatch ? koMatch[1].trim() : keyword.trim();
    // Use English name for search if available, otherwise use the raw keyword
    const searchName = englishName || keyword.trim();

    console.log(`Searching manufacturers for: ${searchName} (ko: ${koreanName}, original: ${keyword})`);

    // Step 1: Use Firecrawl to search for real manufacturer data with multiple strategies
    let searchContext = "";
    if (FIRECRAWL_API_KEY) {
      try {
        const queries = englishName
          ? [
              `"${englishName}" API manufacturer supplier India China pharmaceutical`,
              `"${englishName}" active pharmaceutical ingredient producer`,
            ]
          : [
              `"${searchName}" API manufacturer supplier pharmaceutical`,
              `"${searchName}" 원료의약품 제조사 manufacturer`,
            ];

        const searchResults = await Promise.all(
          queries.map(async (q) => {
            try {
              const resp = await fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: q, limit: 5 }),
                signal: AbortSignal.timeout(10000),
              });
              if (!resp.ok) return [];
              const data = await resp.json();
              return data.data || [];
            } catch {
              return [];
            }
          })
        );

        const allResults = searchResults.flat();
        searchContext = allResults
          .map((r: any) => `[${r.title}] ${r.description || ""} (${r.url})`)
          .join("\n");

        console.log(`Firecrawl found ${allResults.length} search results for context`);
      } catch (e) {
        console.error("Firecrawl search failed, proceeding with AI only:", e);
      }
    }

    // Step 2: Use AI to extract manufacturers — allow AI knowledge + search context
    const contextBlock = searchContext
      ? `\n\n## WEB SEARCH RESULTS (참고용)\n다음 검색 결과를 참고하되, 본인의 지식도 함께 활용하세요:\n${searchContext}`
      : "";

    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) sourcing expert.

Task: Find manufacturers/suppliers of the given API ingredient by region (India, China, Global).

## RULES
1. Use your knowledge of the pharmaceutical industry AND any search results provided.
2. Return well-known, established manufacturers that are widely recognized as producers of this API.
3. For each manufacturer: company name, country, city.
4. Website: provide the company's actual homepage URL. Use the company's native language site (e.g. Chinese site for Chinese companies, Japanese site for Japanese companies). If unsure, set to null.
5. Email & Phone: set to null (do not guess).
6. Return UP TO 3 per region. Quality over quantity — but DO return results if you know real manufacturers.
7. If the ingredient is not a real pharmaceutical compound, return all empty arrays.
8. Include major global producers like Teva, Mylan, BASF, DSM, etc. when applicable.${contextBlock}`,
          },
          {
            role: "user",
            content: `"${searchName}"${englishName ? "" : ` (한국어: ${koreanName})`} 원료의약품(API)의 실제 제조사를 인도, 중국, 글로벌(일본·유럽·미국 등) 지역별로 찾아줘.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_manufacturers",
              description: "Provide manufacturer information for an API ingredient",
              parameters: {
                type: "object",
                properties: {
                  india: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        website: { type: "string", description: "Company homepage URL or null" },
                        email: { type: "string", description: "null" },
                        phone: { type: "string", description: "null" },
                      },
                      required: ["name", "country", "city"],
                      additionalProperties: false,
                    },
                  },
                  china: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        website: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                      required: ["name", "country", "city"],
                      additionalProperties: false,
                    },
                  },
                  global: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        country: { type: "string" },
                        city: { type: "string" },
                        website: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                      required: ["name", "country", "city"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["india", "china", "global"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_manufacturers" } },
      }),
    });

    if (!aiResp.ok) {
      console.error(`Gemini API error: ${aiResp.status}`);
      return new Response(JSON.stringify({ manufacturers: { india: [], china: [], global: [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ manufacturers: { india: [], china: [], global: [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log(`Found manufacturers: India=${parsed.india?.length || 0}, China=${parsed.china?.length || 0}, Global=${parsed.global?.length || 0}`);

    return new Response(JSON.stringify({ manufacturers: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-manufacturers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", manufacturers: { india: [], china: [], global: [] } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
