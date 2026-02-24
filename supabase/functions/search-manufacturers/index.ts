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

    // Extract English name from "한글명 (EnglishName)" format
    const enMatch = keyword.match(/\(([^)]+)\)/);
    const koMatch = keyword.match(/^([가-힣\s]+)/);
    const englishName = enMatch ? enMatch[1].trim() : null;
    const koreanName = koMatch ? koMatch[1].trim() : keyword.trim();
    // Always send BOTH names to Gemini so Korean and English searches yield the same result
    const searchName = englishName || keyword.trim();

    console.log(`Searching manufacturers for: ${searchName} (ko: ${koreanName}, original: ${keyword})`);

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
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) sourcing expert with deep knowledge of global manufacturers.

IMPORTANT: The user may provide a Korean name, English name, or both. You MUST identify the correct API ingredient regardless of language and return the SAME manufacturers whether searched in Korean or English.

For example: "아토르바스타틴" and "Atorvastatin" MUST return the same manufacturers.`,
          },
          {
            role: "user",
            content: `"${searchName}"${koreanName !== searchName ? ` (한국어명: ${koreanName})` : ""}의 원료의약품(API) 제조원을 인도, 중국, 해외(일본·유럽·미국 등) 지역별로 최대 3개씩 알려줘.

조건:
1. WHO-GMP 인증을 받은 제조원을 우선순위로 배치해줘. WHO-GMP 인증이 없으면 있는 만큼만 알려줘.
2. 각 제조원에 대해: 회사명, 국가, 도시, 홈페이지 URL, 연락 가능한 이메일, 전화번호를 알려줘.
3. 홈페이지는 실제 회사 공식 홈페이지 URL을 넣어줘. 확실하지 않으면 null로.
4. 이메일과 전화번호도 공식적으로 알려진 것만 넣고, 모르면 null로.
5. WHO-GMP 인증 여부도 알려줘 (true/false/unknown).
6. 해당 원료가 실제 의약품 성분이 아니면 모두 빈 배열로 반환해.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_manufacturers",
              description: "Provide manufacturer information for an API ingredient by region",
              parameters: {
                type: "object",
                properties: {
                  india: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" }, website: { type: "string", nullable: true }, email: { type: "string", nullable: true }, phone: { type: "string", nullable: true }, whoGmp: { type: "boolean", description: "true if WHO-GMP certified, false if not, null if unknown" } }, required: ["name", "country", "city"] } },
                  china: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" }, website: { type: "string", nullable: true }, email: { type: "string", nullable: true }, phone: { type: "string", nullable: true }, whoGmp: { type: "boolean" } }, required: ["name", "country", "city"] } },
                  global: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, city: { type: "string" }, website: { type: "string", nullable: true }, email: { type: "string", nullable: true }, phone: { type: "string", nullable: true }, whoGmp: { type: "boolean" } }, required: ["name", "country", "city"] } },
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
