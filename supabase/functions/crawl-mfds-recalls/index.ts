import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!FIRECRAWL_API_KEY || !GEMINI_KEY) throw new Error("Missing API keys");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Scrape the recall page
    const url = "https://nedrug.mfds.go.kr/pbp/CCBAI01";
    console.log(`Scraping MFDS recalls: ${url}`);

    const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 20000,
      }),
    });

    if (!scrapeResp.ok) {
      console.error(`Firecrawl scrape failed: ${scrapeResp.status}`);
      throw new Error(`Scrape failed: ${scrapeResp.status}`);
    }

    const scrapeData = await scrapeResp.json();
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    console.log(`Markdown length: ${markdown.length}`);
    if (!markdown || markdown.length < 50) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "No content" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Extract recall data with Gemini
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{
                text: `You extract pharmaceutical recall/disposal (회수·폐기) notices from the Korean MFDS website.

For each recall entry found in the table, extract:
1. "product_name": the product name (제품명)
2. "company": the company name (업체명)  
3. "recall_reason": a concise Korean summary of the recall reason (회수사유) - keep under 50 characters
4. "order_date": the order date (명령일자) in YYYY-MM-DD format
5. "url": if a detail link is available, construct it. Otherwise use empty string.

Return a JSON array of objects. Extract ALL items visible in the table.
Only return valid JSON array, nothing else.

---

${markdown.slice(0, 12000)}`
              }],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiResp.ok) {
      console.error(`Gemini error: ${geminiResp.status}`);
      throw new Error(`Gemini failed: ${geminiResp.status}`);
    }

    const geminiData = await geminiResp.json();
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let recalls: any[] = [];
    try {
      const parsed = JSON.parse(text);
      recalls = Array.isArray(parsed) ? parsed : parsed.recalls || [];
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) recalls = JSON.parse(match[0]);
    }

    console.log(`Extracted ${recalls.length} recall entries`);

    if (recalls.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Dedup by product_name + order_date
    const { data: existing } = await supabase
      .from("mfds_recalls")
      .select("product_name, order_date");
    const existingSet = new Set(
      (existing || []).map((e: any) => `${e.product_name}|${e.order_date}`)
    );

    const newRecalls = recalls
      .filter((r: any) => r.product_name && r.company && r.order_date)
      .map((r: any) => ({
        product_name: r.product_name,
        company: r.company,
        recall_reason: r.recall_reason || "",
        order_date: r.order_date,
        url: r.url || "",
      }))
      .filter((r: any) => !existingSet.has(`${r.product_name}|${r.order_date}`));

    if (newRecalls.length > 0) {
      const { error } = await supabase.from("mfds_recalls").insert(newRecalls);
      if (error) {
        console.error("DB insert error:", error);
        throw error;
      }
    }

    console.log(`Inserted ${newRecalls.length} new recalls (${recalls.length - newRecalls.length} dupes skipped)`);

    return new Response(
      JSON.stringify({ success: true, total: recalls.length, inserted: newRecalls.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-mfds-recalls error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
