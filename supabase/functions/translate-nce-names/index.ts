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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get items without Korean name
    const { data: items, error } = await supabase
      .from("nce_patent_expiry")
      .select("id, api_name")
      .is("api_name_ko", null)
      .limit(50);

    if (error) throw error;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "All translated", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Translating ${items.length} API names to Korean...`);

    const nameList = items.map((d) => d.api_name).join("\n");

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a pharmaceutical expert. Translate these drug ingredient names (API names) to Korean. Return a JSON array with exact english name and korean translation.

${nameList}

Return JSON array only:
[{"en":"MEROPENEM","ko":"메로페넴"},{"en":"SECNIDAZOLE","ko":"세크니다졸"}]

Rules:
- Use standard Korean pharmaceutical naming (대한약전 기준)
- For compound names like "MEROPENEM; VABORBACTAM", translate both: "메로페넴; 바보르박탐"
- Include salt forms in Korean too (e.g., TOSYLATE → 토실산염)
- Return ALL ${items.length} items`,
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
    
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in AI response");

    const translations: { en: string; ko: string }[] = JSON.parse(jsonMatch[0]);
    console.log(`Got ${translations.length} translations`);

    let updated = 0;
    for (const t of translations) {
      const match = items.find((i) => i.api_name.toLowerCase() === t.en.toLowerCase());
      if (match) {
        const { error: updateErr } = await supabase
          .from("nce_patent_expiry")
          .update({ api_name_ko: t.ko })
          .eq("id", match.id);
        if (!updateErr) updated++;
        else console.error("Update error:", updateErr);
      }
    }

    console.log(`Translated ${updated}/${items.length}`);

    return new Response(
      JSON.stringify({ success: true, count: updated, remaining: items.length - updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("translate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
