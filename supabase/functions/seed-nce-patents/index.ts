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

    // Check if data already exists
    const { count } = await supabase.from("nce_patent_expiry").select("*", { count: "exact", head: true });
    if (count && count > 50) {
      return new Response(JSON.stringify({ success: true, message: "Data already seeded", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate NCE patent data in batches using AI
    const batches = [
      "항암제 (면역항암제, 표적항암제, 세포독성 항암제 등) 관련 NCE 특허 만료 예정 의약품 60개",
      "심혈관계 (항응고제, 고혈압, 고지혈증, 심부전 등) 및 당뇨/대사질환 (GLP-1, SGLT2, DPP-4 등) 관련 NCE 특허 만료 예정 의약품 60개",
      "중추신경계 (항우울제, 항정신병, 항간질, 알츠하이머 등) 및 통증/염증 (류마티스, 골다공증 등) 관련 NCE 특허 만료 예정 의약품 60개",
      "감염병 (항바이러스, 항생제, 항진균제 등) 및 호흡기/면역 (천식, COPD, 자가면역 등) 관련 NCE 특허 만료 예정 의약품 60개",
      "안과, 피부과, 비뇨기과, 소화기, 혈액질환, 희귀질환 등 기타 NCE 특허 만료 예정 의약품 60개",
    ];

    const allData: any[] = [];

    for (let i = 0; i < batches.length; i++) {
      console.log(`Generating batch ${i + 1}/${batches.length}`);

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
                content: `You are a pharmaceutical patent expert. Generate accurate NCE (New Chemical Entity) patent expiry data for the global pharmaceutical market. Use real drug names and realistic patent expiry dates between 2025 and 2035. Return data using the extract_patents tool.`,
              },
              {
                role: "user",
                content: `${batches[i]}를 생성해주세요. 각 의약품에 대해:
- product_name: 제품명 (예: Keytruda)
- api_name: 원료의약품명 "한글 (영문)" 형식 (예: 펨브롤리주맙 (Pembrolizumab))
- company: 제조사
- expiry_date: 특허 만료일 YYYY-MM-DD 형식 (2025~2035)
- indication: 주요 적응증 (한글, 간결하게)
- market_size: 글로벌 연 매출 규모 (예: "$20B", "$500M" 등)
- recommendation: 원료의약품 사업 추천도 1~5 (5가 최고, 시장성·제네릭 진입 용이성·수요 기반)

실제 존재하는 의약품과 정확한 데이터를 사용하세요. 중복 없이 60개를 생성하세요.`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "extract_patents",
                  description: "Extract NCE patent expiry data",
                  parameters: {
                    type: "object",
                    properties: {
                      patents: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            product_name: { type: "string" },
                            api_name: { type: "string" },
                            company: { type: "string" },
                            expiry_date: { type: "string" },
                            indication: { type: "string" },
                            market_size: { type: "string" },
                            recommendation: { type: "integer" },
                          },
                          required: ["product_name", "api_name", "company", "expiry_date", "indication", "market_size", "recommendation"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["patents"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "extract_patents" } },
          }),
        }
      );

      if (!aiResp.ok) {
        console.error(`AI batch ${i + 1} failed: ${aiResp.status}`);
        if (aiResp.status === 429) {
          console.log("Rate limited, waiting 10s...");
          await new Promise((r) => setTimeout(r, 10000));
          i--; // retry
          continue;
        }
        continue;
      }

      const aiData = await aiResp.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) continue;

      const parsed = JSON.parse(toolCall.function.arguments);
      if (parsed.patents) {
        allData.push(...parsed.patents);
      }
      console.log(`Batch ${i + 1}: got ${parsed.patents?.length || 0} items`);

      // Small delay between batches
      if (i < batches.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // Deduplicate by api_name
    const seen = new Set<string>();
    const unique = allData.filter((d) => {
      const key = d.api_name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length > 0) {
      // Clear existing data
      await supabase.from("nce_patent_expiry").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert in chunks of 50
      for (let i = 0; i < unique.length; i += 50) {
        const chunk = unique.slice(i, i + 50);
        const { error } = await supabase.from("nce_patent_expiry").insert(chunk);
        if (error) {
          console.error("Insert error:", error);
        }
      }
    }

    console.log(`Seeded ${unique.length} NCE patent entries`);

    return new Response(
      JSON.stringify({ success: true, count: unique.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("seed-nce-patents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
