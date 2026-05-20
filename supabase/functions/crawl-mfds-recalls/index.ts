import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseRecalls(html: string): Array<{ product_name: string; company: string; recall_reason: string; order_date: string; url: string }> {
  const recalls: Array<{ product_name: string; company: string; recall_reason: string; order_date: string; url: string }> = [];
  const rows = html.split(/<tr[^>]*>/gi);

  for (const row of rows) {
    if (!row.includes("회수명령일자")) continue;

    const productMatch = row.match(/제품명<\/span>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/i);
    if (!productMatch) continue;
    const product_name = productMatch[2].trim();
    const itemPath = productMatch[1].trim();
    const url = itemPath.startsWith("http") ? itemPath : `https://nedrug.mfds.go.kr${itemPath}`;

    const companyMatch = row.match(/업체명<\/span>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const company = companyMatch ? companyMatch[1].trim() : "";

    const reasonMatch = row.match(/회수사유<\/span><span>([^<]+)<\/span>/i);
    const recall_reason = reasonMatch ? reasonMatch[1].trim() : "";

    const dateMatch = row.match(/회수명령일자<\/span><span>(\d{4}-\d{2}-\d{2})<\/span>/i);
    const order_date = dateMatch ? dateMatch[1] : "";

    if (product_name && order_date) {
      recalls.push({ product_name, company, recall_reason, order_date, url });
    }
  }

  return recalls;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("Fetching MFDS recalls from nedrug.mfds.go.kr...");
    const resp = await fetch("https://nedrug.mfds.go.kr/pbp/CCBAI01", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();
    const recalls = parseRecalls(html);
    console.log(`Parsed ${recalls.length} recalls`);

    if (recalls.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "No recalls parsed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("mfds_recalls")
      .select("product_name, order_date");
    const existingSet = new Set(
      (existing || []).map((e: any) => `${e.product_name}|${e.order_date}`)
    );

    const newRecalls = recalls.filter(
      (r) => !existingSet.has(`${r.product_name}|${r.order_date}`)
    );

    if (newRecalls.length > 0) {
      const { error } = await supabase.from("mfds_recalls").insert(newRecalls);
      if (error) throw error;
    }

    console.log(`Inserted ${newRecalls.length} new recalls`);
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
