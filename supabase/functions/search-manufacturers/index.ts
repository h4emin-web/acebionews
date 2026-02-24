const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const empty = { india: [], china: [], global: [] };

// Firecrawl search to verify a manufacturer actually produces the given API ingredient
async function verifyManufacturer(
  manufacturer: { name: string; country: string; city: string },
  ingredient: string,
  apiKey: string
): Promise<{ verified: boolean; website: string | null }> {
  try {
    // Search specifically for this manufacturer + ingredient combination
    const query = `"${manufacturer.name}" "${ingredient}" API pharmaceutical manufacturer site:${guessDomain(manufacturer.name)}`;
    const fallbackQuery = `"${manufacturer.name}" "${ingredient}" API active pharmaceutical ingredient manufacturer`;

    let results = await firecrawlSearch(query, apiKey);
    if (results.length === 0) {
      results = await firecrawlSearch(fallbackQuery, apiKey);
    }
    if (results.length === 0) {
      // Try with just company name to at least find the website
      results = await firecrawlSearch(`"${manufacturer.name}" pharmaceutical API manufacturer official website`, apiKey);
    }

    let website: string | null = null;
    let verified = false;

    for (const r of results) {
      const url = r.url || "";
      const text = ((r.markdown || "") + " " + (r.description || "") + " " + (r.title || "")).toLowerCase();
      const lowerUrl = url.toLowerCase();

      // Skip directory/social sites
      if (isDirectorySite(lowerUrl)) continue;

      // Check if the result mentions both the company and the ingredient
      const companyWords = manufacturer.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const mentionsCompany = companyWords.some(w => text.includes(w));
      const mentionsIngredient = text.includes(ingredient.toLowerCase());

      if (mentionsCompany && !website) {
        website = url;
      }
      if (mentionsCompany && mentionsIngredient) {
        verified = true;
        if (!website) website = url;
        break;
      }
    }

    return { verified, website };
  } catch {
    return { verified: false, website: null };
  }
}

function guessDomain(companyName: string): string {
  // Try to create a plausible domain from company name
  const clean = companyName.toLowerCase()
    .replace(/\s*(pvt|ltd|limited|inc|corp|co|pharma|pharmaceutical|chemicals|labs|laboratories)\s*/gi, "")
    .trim()
    .replace(/\s+/g, "");
  return `${clean}.com`;
}

function isDirectorySite(url: string): boolean {
  const directories = [
    "linkedin.com", "wikipedia.org", "bloomberg.com", "crunchbase.com",
    "dnb.com", "zoominfo.com", "facebook.com", "twitter.com", "x.com",
    "youtube.com", "amazon.com", "alibaba.com", "indiamart.com",
    "tradeindia.com", "justdial.com", "glassdoor.com", "indeed.com",
  ];
  return directories.some(d => url.includes(d));
}

async function firecrawlSearch(query: string, apiKey: string): Promise<any[]> {
  try {
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.data || [];
  } catch {
    return [];
  }
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

    // Step 1: Use Gemini to identify manufacturer NAMES
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
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) sourcing expert. Identify REAL, well-known API manufacturers only.

RULES:
- Only list companies that are WIDELY KNOWN to manufacture this specific API ingredient.
- Prefer companies with CEP (Certificate of Suitability), US DMF, KDMF, or WHO prequalification for this ingredient.
- Do NOT guess or hallucinate. If unsure, return fewer results or empty arrays.
- For India: focus on major API exporters (e.g., Dr. Reddy's, Aurobindo, Hetero, MSN Labs, Laurus Labs, etc.)
- For China: focus on major API producers (e.g., Zhejiang Huahai, Apeloa, Zhejiang Hisun, etc.)
- For Global: Japan, Europe, US manufacturers
- Return at most 3 per region. Quality over quantity.`,
          },
          {
            role: "user",
            content: `"${searchName}"${koreanName !== searchName ? ` (한국어명: ${koreanName})` : ""}의 원료의약품(API) 제조원을 인도, 중국, 해외(일본·유럽·미국 등) 지역별로 알려줘.

조건:
1. 해당 성분의 API를 실제로 상업적으로 제조·판매하는 것으로 널리 알려진 회사만.
2. CEP, US DMF, WHO PQ 등 인증을 보유한 회사 우선.
3. 확실하지 않으면 빈 배열로.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_manufacturers",
              description: "Provide verified manufacturer names for an API ingredient by region",
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

    // Step 2: Verify each manufacturer with Firecrawl and find real websites
    console.log(`[Step 2] Firecrawl: verifying manufacturers...`);

    const verifyRegion = async (manufacturers: any[]) => {
      const results = await Promise.all(
        manufacturers.map(async (m: any) => {
          const { verified, website } = await verifyManufacturer(m, searchName, FIRECRAWL_API_KEY);
          console.log(`  ${m.name}: verified=${verified}, website=${website || "none"}`);
          return { ...m, website, verified };
        })
      );
      // Return all but sort verified ones first
      return results
        .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0))
        .map(({ verified, ...rest }) => rest);
    };

    const [india, china, global] = await Promise.all([
      verifyRegion(parsed.india || []),
      verifyRegion(parsed.china || []),
      verifyRegion(parsed.global || []),
    ]);

    console.log(`[Step 2] Verification complete`);

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
