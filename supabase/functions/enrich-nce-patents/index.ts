import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get items without AI analysis
    const { data: items, error } = await supabase
      .from("nce_patent_expiry")
      .select("*")
      .is("indication", null)
      .order("expiry_date", { ascending: true })
      .limit(30);

    if (error) throw error;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "All items already enriched", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Enriching ${items.length} NCE patents with AI...`);

    const drugList = items.map((d) => `- ${d.product_name} (${d.api_name}) by ${d.company}`).join("\n");

    const aiResp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
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
              content: `You are a pharmaceutical industry expert. Analyze drugs and provide indication, market size, and business recommendation for API (Active Pharmaceutical Ingredient) importers/manufacturers. Return data using the enrich_drugs tool.`,
            },
            {
              role: "user",
              content: `다음 NCE 의약품들에 대해 각각 분석해주세요:

${drugList}

각 의약품에 대해:
- indication: 주요 적응증 (한글, 간결하게 15자 이내)
- market_size: 글로벌 연 매출 추정 (예: "$20B", "$500M", "$50M" 등)
- recommendation: 원료의약품 사업 추천도 1~5 (시장 크기, 제네릭 진입 용이성, 수요 전망 기반. 5=매우추천)

product_name을 key로 사용하세요.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "enrich_drugs",
                description: "Enrich drug data with indication, market size, and recommendation",
                parameters: {
                  type: "object",
                  properties: {
                    drugs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          product_name: { type: "string" },
                          indication: { type: "string" },
                          market_size: { type: "string" },
                          recommendation: { type: "integer" },
                        },
                        required: ["product_name", "indication", "market_size", "recommendation"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["drugs"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "enrich_drugs" } },
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const drugs = parsed.drugs || [];

    let updated = 0;
    for (const drug of drugs) {
      const match = items.find((i) => i.product_name === drug.product_name);
      if (match) {
        const { error: updateErr } = await supabase
          .from("nce_patent_expiry")
          .update({
            indication: drug.indication,
            market_size: drug.market_size,
            recommendation: Math.min(5, Math.max(1, drug.recommendation)),
          })
          .eq("id", match.id);
        if (!updateErr) updated++;
      }
    }

    console.log(`Enriched ${updated}/${items.length} items`);

    return new Response(
      JSON.stringify({ success: true, count: updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-nce error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
