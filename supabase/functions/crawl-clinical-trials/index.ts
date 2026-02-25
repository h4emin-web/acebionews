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
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build date range: from 2026-01-01 to today
    const now = new Date();
    const endDate = now.toISOString().split("T")[0];
    const startDate = "2026-01-01";

    let allTrials: any[] = [];
    let page = 1;
    const maxPages = 30;

    while (page <= maxPages) {
      const url = `https://nedrug.mfds.go.kr/searchClinic?page=${page}&searchYn=true&approvalStart=&approvalEnd=&searchType=ST3&searchKeyword=&approvalDtStart=${startDate}&approvalDtEnd=${endDate}&clinicStepCode=&examFinish=%EC%8A%B9%EC%9D%B8%EC%99%84%EB%A3%8C&domestic=&gender=&age=&localList=000&localList2=`;

      console.log(`Fetching page ${page}...`);

      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          waitFor: 5000,
          timeout: 60000,
        }),
      });

      if (!scrapeResp.ok) {
        const errText = await scrapeResp.text();
        console.error(`Firecrawl error page ${page}:`, scrapeResp.status, errText);
        break;
      }

      const scrapeData = await scrapeResp.json();
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";

      // Parse table rows from markdown
      const trials = parseTrialsFromMarkdown(markdown);
      console.log(`Page ${page}: found ${trials.length} trials`);

      if (trials.length === 0) break;

      allTrials = allTrials.concat(trials);
      page++;

      // Small delay between pages
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(`Total trials scraped: ${allTrials.length}`);

    if (allTrials.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No trials found", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI summaries for trials without summaries
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (GEMINI_KEY) {
      // Batch summarize in groups of 10
      for (let i = 0; i < allTrials.length; i += 10) {
        const batch = allTrials.slice(i, i + 10);
        try {
          const prompt = `아래 임상시험 목록을 각각 1줄(30자 이내)로 핵심만 요약해줘.
형식: 번호|요약
규칙:
- 적응증 + 핵심 디자인만 (예: "주요우울장애 대상 보조치료 유효성·안전성 비교")
- 생동시험은 "XX vs YY 생물학적 동등성 평가"
- 불필요한 수식어(다기관, 무작위배정 등) 제외
- 약물명은 제외 (이미 별도 표시됨)

${batch.map((t: any, idx: number) => `${idx + 1}. ${t.trial_title}`).join("\n")}`;

          const geminiResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            }
          );
          if (geminiResp.ok) {
            const geminiData = await geminiResp.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const lines = text.split("\n").filter((l: string) => l.trim());
            for (const line of lines) {
              const match = line.match(/^(\d+)\|(.+)/);
              if (match) {
                const idx = parseInt(match[1]) - 1;
                if (idx >= 0 && idx < batch.length) {
                  batch[idx].summary = match[2].trim();
                }
              }
            }
          }
        } catch (e) {
          console.error("Summary generation error:", e);
        }
      }
    }

    // Upsert into DB
    let inserted = 0;
    for (const trial of allTrials) {
      const { error } = await supabase
        .from("clinical_trial_approvals")
        .upsert(trial, { onConflict: "seq_number,approval_date,product_name" });
      if (!error) inserted++;
      else console.error("Upsert error:", error.message, trial.product_name);
    }

    console.log(`Inserted/updated ${inserted}/${allTrials.length} trials`);

    return new Response(
      JSON.stringify({ success: true, inserted, total: allTrials.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-clinical-trials error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseTrialsFromMarkdown(markdown: string): any[] {
  const trials: any[] = [];

  // Split into lines and find table rows
  const lines = markdown.split("\n");
  
  for (const line of lines) {
    // Look for rows with bold field markers like **순번** N | **진행현황** ...
    if (!line.includes("**순번**") || !line.includes("**승인일**")) continue;

    try {
      const seqMatch = line.match(/\*\*순번\*\*\s*(\d+)/);
      const sponsorMatch = line.match(/\*\*의뢰자\*\*\s*([^|]*?)(?:\s*\||\s*$)/);
      const productMatch = line.match(/\*\*제품명\*\*\s*([^|]*?)(?:\s*\||\s*$)/);
      const titleMatch = line.match(/\*\*임상시험 제목\*\*\s*\[([^\]]*)\]/);
      const phaseMatch = line.match(/\*\*임상시험 단계\*\*\s*([^|]*?)(?:\s*\||\s*$)/);
      const regionMatch = line.match(/\*\*개발지역\*\*\s*([^|]*?)(?:\s*\||\s*$)/);
      const dateMatch = line.match(/\*\*승인일\*\*\s*([\d-]+)/);

      if (seqMatch && dateMatch && productMatch) {
        trials.push({
          seq_number: parseInt(seqMatch[1]),
          sponsor: (sponsorMatch?.[1] || "").trim(),
          product_name: (productMatch?.[1] || "").trim(),
          trial_title: (titleMatch?.[1] || "").trim(),
          phase: (phaseMatch?.[1] || "").trim(),
          approval_date: dateMatch[1].trim(),
          dev_region: (regionMatch?.[1] || "").trim(),
        });
      }
    } catch (parseErr) {
      console.error("Parse error for line:", line.slice(0, 100), parseErr);
    }
  }

  return trials;
}
