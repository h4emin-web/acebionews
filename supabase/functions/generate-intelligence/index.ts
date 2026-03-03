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
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get date ranges
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Fetch recent news for context
    const [weeklyNews, monthlyNews, deals, trials, patents] = await Promise.all([
      supabase.from("news_articles").select("title, summary, source, region, category").gte("date", weekAgoStr).order("date", { ascending: false }).limit(80),
      supabase.from("news_articles").select("title, summary, category").gte("date", monthStart).order("date", { ascending: false }).limit(150),
      supabase.from("biotech_deals").select("payer, payee, total_m, indication, technology, date").gte("date", monthStart).order("date", { ascending: false }).limit(20),
      supabase.from("clinical_trial_approvals").select("product_name, sponsor, phase, summary, approval_date").gte("approval_date", weekAgoStr).order("approval_date", { ascending: false }).limit(20),
      supabase.from("nce_patent_expiry").select("product_name, api_name, api_name_ko, company, expiry_date, indication, market_size").order("expiry_date", { ascending: true }).limit(20),
    ]);

    const weeklyNewsList = (weeklyNews.data || []).map((n: any) => `[${n.region}/${n.source}] ${n.title}: ${n.summary?.slice(0, 80)}`).join("\n");
    const monthlyNewsList = (monthlyNews.data || []).map((n: any) => `[${n.category}] ${n.title}`).join("\n");
    const dealsList = (deals.data || []).map((d: any) => `${d.payer} → ${d.payee}: $${d.total_m}M (${d.indication}, ${d.technology})`).join("\n");
    const trialsList = (trials.data || []).map((t: any) => `${t.sponsor} - ${t.product_name} (${t.phase}): ${t.summary || ''}`).join("\n");
    const patentsList = (patents.data || []).map((p: any) => `${p.product_name} (${p.api_name_ko || p.api_name}) - ${p.company} - 만료: ${p.expiry_date} - ${p.indication || ''} - 시장: ${p.market_size || '미상'}`).join("\n");

    // Generate all three sections
    const prompt = `당신은 제약·바이오 산업 전문 애널리스트입니다. 아래 데이터를 분석하여 3개 섹션의 인텔리전스 요약을 작성하세요.

## 입력 데이터

### 이번주 뉴스 (최근 7일)
${weeklyNewsList || "데이터 없음"}

### 이번달 뉴스
${monthlyNewsList || "데이터 없음"}

### 최근 빅딜
${dealsList || "데이터 없음"}

### 최근 IND 승인
${trialsList || "데이터 없음"}

### 특허 만료 예정 신약
${patentsList || "데이터 없음"}

## 출력 형식 (반드시 이 형식을 정확히 따르세요)

===WEEKLY_ISSUES===
- 이번주 가장 중요한 제약·바이오 R&D 이슈 5~7개를 불릿포인트로 작성
- 각 항목은 구체적인 기업명, 약물명, 수치를 포함한 1~2문장
- 임상시험 결과, 규제 승인, 대형 딜, 기술 트렌드 중심
- 국내외 균형 있게 포함

===MONTHLY_ISSUES===
- 이번달 전체를 관통하는 주요 트렌드와 이슈 4~6개
- 각 항목은 카테고리별로 묶어서 서술 (예: 항암제, ADC, GLP-1, 바이오시밀러 등)
- 시장 동향, 규제 변화, 기술 트렌드를 포괄

===API_MARKET===
- 원료의약품(API) 시장 관련 인사이트 4~6개
- 특허 만료 예정 블록버스터 의약품과 제네릭/바이오시밀러 기회
- DMF 동향, 글로벌 API 공급망 이슈
- 한국 기업에 대한 시사점 포함
- 구체적인 약물명과 예상 시장 규모 언급`;

    console.log("Generating intelligence summary...");

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.3 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const err = await geminiResp.text();
      throw new Error(`Gemini error: ${geminiResp.status} ${err}`);
    }

    const geminiData = await geminiResp.json();
    const fullText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("Generated text length:", fullText.length);

    // Parse sections
    const weeklyMatch = fullText.match(/===WEEKLY_ISSUES===\s*([\s\S]*?)(?====MONTHLY_ISSUES===|$)/);
    const monthlyMatch = fullText.match(/===MONTHLY_ISSUES===\s*([\s\S]*?)(?====API_MARKET===|$)/);
    const apiMatch = fullText.match(/===API_MARKET===\s*([\s\S]*?)$/);

    const sections = [
      { section: "weekly_issues", content: weeklyMatch?.[1]?.trim() || "" },
      { section: "monthly_issues", content: monthlyMatch?.[1]?.trim() || "" },
      { section: "api_market", content: apiMatch?.[1]?.trim() || "" },
    ];

    let upserted = 0;
    for (const s of sections) {
      if (!s.content) continue;
      const { error } = await supabase
        .from("intelligence_summaries")
        .upsert(
          { summary_date: today, section: s.section, content: s.content },
          { onConflict: "summary_date,section" }
        );
      if (!error) upserted++;
      else console.error(`Upsert error for ${s.section}:`, error.message);
    }

    console.log(`Upserted ${upserted}/3 sections`);

    return new Response(
      JSON.stringify({ success: true, upserted, date: today }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-intelligence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
