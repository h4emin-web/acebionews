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

    // Extract English name if keyword contains parentheses like "니세르골린 (Nicergoline)"
    const enMatch = keyword.match(/\(([^)]+)\)/);
    const searchName = enMatch ? enMatch[1].trim() : keyword.trim();
    // Normalize: always use the same search term regardless of input language
    const isKorean = /[가-힣]/.test(searchName);

    console.log(`Searching manufacturers for: ${searchName} (original: ${keyword})`);

    // Step 1: Use Firecrawl to search for real manufacturer data
    let searchContext = "";
    if (FIRECRAWL_API_KEY) {
      try {
        const queries = [
          `"${searchName}" API manufacturer supplier pharmaceutical India China`,
          `"${searchName}" active pharmaceutical ingredient producer GMP`,
        ];

        const searchResults = await Promise.all(
          queries.map(async (q) => {
            const resp = await fetch("https://api.firecrawl.dev/v1/search", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: q, limit: 5 }),
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return data.data || [];
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

    // Step 2: Use AI with search context to extract verified manufacturers
    const contextBlock = searchContext
      ? `\n\n## SEARCH RESULTS FOR REFERENCE\nUse ONLY the following search results to identify real manufacturers. Do NOT add any manufacturer that is not mentioned or verifiable from these results:\n${searchContext}`
      : "";

    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) sourcing expert with deep knowledge of global API manufacturers.

Task: Find REAL manufacturers/suppliers of the given API ingredient, categorized by region (India, China, Global).

## RULES
1. Return ONLY manufacturers you are confident actually produce or supply this specific API ingredient.
2. For each manufacturer provide: company name (English), country, city.
3. Website: provide the company's REAL homepage URL. If unsure, set to null. NEVER guess a URL.
4. Email & Phone: provide ONLY if you are certain. Otherwise null. NEVER fabricate contact info.
5. Return UP TO 3 per region. Fewer or zero is fine - accuracy over quantity.
6. The SAME search term in Korean or English MUST return the same manufacturers.
7. If the ingredient is not a real pharmaceutical compound, return all empty arrays.
8. Prefer well-known, established manufacturers (e.g. WHO-GMP certified, CEP holders, major API producers).${contextBlock}`,
          },
          {
            role: "user",
            content: `"${searchName}" 원료의약품(API)을 실제로 제조하거나 공급하는 회사를 인도, 중국, 해외(일본·유럽·미국 등) 지역별로 찾아줘. 각 회사의 홈페이지, 이메일, 전화번호를 정확히 알려줘.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_manufacturers",
              description: "Provide verified manufacturer information for an API ingredient",
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
                        website: { type: "string", description: "Exact verified URL only, or null" },
                        email: { type: "string", description: "Exact verified email only, or null" },
                        phone: { type: "string", description: "Exact verified phone only, or null" },
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
