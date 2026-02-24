const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const empty = { india: [], china: [], global: [] };

async function firecrawlSearch(query: string, apiKey: string): Promise<any[]> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 3 }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.data || [];
  } catch {
    return [];
  }
}

async function verifyAndEnrich(
  manufacturers: { name: string; country: string; city: string }[],
  firecrawlKey: string
): Promise<any[]> {
  const results = await Promise.all(
    manufacturers.map(async (m) => {
      // Search for the manufacturer's official website
      const searchResults = await firecrawlSearch(
        `${m.name} ${m.country} pharmaceutical API manufacturer official website contact`,
        firecrawlKey
      );

      let website: string | null = null;
      let email: string | null = null;
      let phone: string | null = null;

      if (searchResults.length > 0) {
        // Use the first result's URL as the website
        const topResult = searchResults[0];
        const candidateUrl = topResult.url || null;

        // Validate: URL should look like a real company site (not a directory listing)
        if (candidateUrl) {
          const lowerUrl = candidateUrl.toLowerCase();
          const isDirectory =
            lowerUrl.includes("linkedin.com") ||
            lowerUrl.includes("wikipedia.org") ||
            lowerUrl.includes("bloomberg.com") ||
            lowerUrl.includes("crunchbase.com") ||
            lowerUrl.includes("dnb.com") ||
            lowerUrl.includes("zoominfo.com");
          if (!isDirectory) {
            website = candidateUrl;
          }
        }

        // Try to extract email and phone from the search results' markdown/description
        for (const r of searchResults) {
          const text = (r.markdown || r.description || "").slice(0, 3000);
          if (!email) {
            const emailMatch = text.match(
              /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
            );
            if (emailMatch) email = emailMatch[0];
          }
          if (!phone) {
            const phoneMatch = text.match(
              /(?:\+?\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?){1,3}\d{3,4}[\s\-]?\d{3,4}/
            );
            if (phoneMatch && phoneMatch[0].replace(/\D/g, "").length >= 8) {
              phone = phoneMatch[0].trim();
            }
          }
        }

        // If no website from search, try to find one in the text
        if (!website) {
          for (const r of searchResults) {
            const text = r.markdown || r.description || "";
            const urlMatch = text.match(
              /https?:\/\/(?:www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\/[^\s)]*)?/
            );
            if (urlMatch) {
              website = urlMatch[0];
              break;
            }
          }
        }
      }

      return {
        name: m.name,
        country: m.country,
        city: m.city,
        website,
        email,
        phone,
        whoGmp: null, // Can't verify WHO-GMP from web search
      };
    })
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword } = await req.json();
    if (!keyword || keyword.trim().length < 2) {
      return new Response(JSON.stringify({ manufacturers: empty }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    // Extract names
    const enMatch = keyword.match(/\(([^)]+)\)/);
    const koMatch = keyword.match(/^([가-힣\s]+)/);
    const englishName = enMatch ? enMatch[1].trim() : null;
    const koreanName = koMatch ? koMatch[1].trim() : keyword.trim();
    const searchName = englishName || keyword.trim();

    console.log(`[Step 1] Gemini: identifying manufacturers for "${searchName}"`);

    // Step 1: Use Gemini ONLY for identifying manufacturer NAMES (no URLs/contacts)
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
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) sourcing expert. Your job is to identify REAL manufacturer names only. Do NOT make up names. If you are not sure, return fewer results.

IMPORTANT: The user may provide Korean or English name. "아토르바스타틴" and "Atorvastatin" are the same ingredient - return the SAME manufacturers.`,
          },
          {
            role: "user",
            content: `"${searchName}"${koreanName !== searchName ? ` (한국어명: ${koreanName})` : ""}의 원료의약품(API) 제조원을 인도, 중국, 해외(일본·유럽·미국 등) 지역별로 최대 3개씩 알려줘.

조건:
1. 실제로 존재하는 회사만 알려줘. 확실하지 않으면 적게 알려줘.
2. 각 제조원에 대해: 회사명, 국가, 도시만 알려줘.
3. 해당 원료가 실제 의약품 성분이 아니면 모두 빈 배열로 반환해.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_manufacturers",
              description: "Provide manufacturer names for an API ingredient by region",
              parameters: {
                type: "object",
                properties: {
                  india: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" } }, required: ["name", "country", "city"] } },
                  china: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" } }, required: ["name", "country", "city"] } },
                  global: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" } }, required: ["name", "country", "city"] } },
                },
                required: ["india", "china", "global"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_manufacturers" } },
      }),
    });

    if (!aiResp.ok) {
      console.error(`Gemini API error: ${aiResp.status}`);
      return new Response(JSON.stringify({ manufacturers: empty }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ manufacturers: empty }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    console.log(`[Step 1] Found: India=${parsed.india?.length || 0}, China=${parsed.china?.length || 0}, Global=${parsed.global?.length || 0}`);

    // Step 2: Use Firecrawl to verify and enrich each manufacturer with real data
    console.log(`[Step 2] Firecrawl: verifying websites and contacts...`);

    const [india, china, global] = await Promise.all([
      verifyAndEnrich(parsed.india || [], FIRECRAWL_API_KEY),
      verifyAndEnrich(parsed.china || [], FIRECRAWL_API_KEY),
      verifyAndEnrich(parsed.global || [], FIRECRAWL_API_KEY),
    ]);

    console.log(`[Step 2] Enrichment complete`);

    return new Response(JSON.stringify({ manufacturers: { india, china, global } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-manufacturers error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", manufacturers: empty }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
