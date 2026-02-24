import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword } = await req.json();
    if (!keyword || keyword.trim().length < 2) {
      return new Response(JSON.stringify({ manufacturers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    console.log(`Searching manufacturers for: ${keyword}`);

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
            content: `You are a pharmaceutical API (Active Pharmaceutical Ingredient) manufacturing expert.

Given an API ingredient name, provide REAL manufacturer information organized by region.

## RULES
- Only return REAL, verified manufacturers that actually produce the given API ingredient.
- Prioritize WHO-GMP certified facilities when possible.
- For each manufacturer provide: company name, country, city, WHO-GMP status (true/false), website URL, email, phone number.
- If you cannot find verified info for a field, set it to null. Do NOT make up contact details.
- Return exactly 3 manufacturers per region when possible. If fewer exist, return what you can.
- Regions: India (인도), China (중국), Global (해외 - Japan, Europe, USA, etc.)
- For the "global" region, prefer diverse countries (e.g. one from Japan, one from Europe, one from USA).
- Company names should be in English.
- If the ingredient is not a real pharmaceutical API, return empty arrays.`,
          },
          {
            role: "user",
            content: `Find manufacturers for the API ingredient: "${keyword}"`,
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
                        whoGmp: { type: "boolean" },
                        website: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                      required: ["name", "country", "city", "whoGmp"],
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
                        whoGmp: { type: "boolean" },
                        website: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                      required: ["name", "country", "city", "whoGmp"],
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
                        whoGmp: { type: "boolean" },
                        website: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                      },
                      required: ["name", "country", "city", "whoGmp"],
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
      return new Response(JSON.stringify({ manufacturers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ manufacturers: [] }), {
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", manufacturers: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
