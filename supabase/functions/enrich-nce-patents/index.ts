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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a pharmaceutical industry expert. 다음 NCE 의약품들에 대해 각각 분석해서 JSON 배열로 반환해주세요.

${drugList}

각 의약품에 대해:
- product_name: 입력된 품명 그대로 (대문자 유지)
- indication: 주요 적응증 (한글, 간결하게 15자 이내)
- market_size: 글로벌 연 매출 추정 (예: "$20B", "$500M", "$50M")
- recommendation: 원료의약품 사업 추천도 1~5 (시장 크기, 제네릭 진입 용이성, 수요 전망 기반)

JSON 배열만 반환하세요:
[{"product_name":"DRUG","indication":"적응증","market_size":"$1B","recommendation":3}]`,
            }],
          }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("AI response preview:", content.slice(0, 300));

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in AI response: " + content.slice(0, 200));

    const drugs = JSON.parse(jsonMatch[0]);
    console.log(`Parsed ${drugs.length} drugs from AI`);

    let updated = 0;
    for (const drug of drugs) {
      const drugName = (drug.product_name || "").split("(")[0].trim().toLowerCase();
      const match = items.find((i) => i.product_name.toLowerCase() === drugName);
      if (match) {
        const { error: updateErr } = await supabase
          .from("nce_patent_expiry")
          .update({
            indication: drug.indication,
            market_size: drug.market_size,
            recommendation: Math.min(5, Math.max(1, drug.recommendation || 1)),
          })
          .eq("id", match.id);
        if (!updateErr) updated++;
        else console.error("Update error for", match.product_name, updateErr);
      } else {
        console.log("No match for:", drug.product_name);
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
