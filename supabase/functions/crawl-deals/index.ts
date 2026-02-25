import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Country name → ISO 2-letter code
const COUNTRY_MAP: Record<string, string> = {
  "united states": "us", "us": "us", "usa": "us",
  "uk": "gb", "united kingdom": "gb", "britain": "gb",
  "japan": "jp", "china": "cn", "germany": "de",
  "france": "fr", "switzerland": "ch", "australia": "au",
  "sweden": "se", "denmark": "dk", "italy": "it",
  "spain": "es", "south korea": "kr", "korea": "kr",
  "canada": "ca", "india": "in", "ireland": "ie",
  "netherlands": "nl", "belgium": "be", "israel": "il",
  "brazil": "br", "singapore": "sg", "taiwan": "tw",
  "norway": "no", "finland": "fi", "austria": "at",
};

function countryToCode(name: string): string {
  return COUNTRY_MAP[name.toLowerCase().trim()] || name.toLowerCase().slice(0, 2);
}

// Technology translation map
const TECH_TRANSLATIONS: Record<string, string> = {
  "car-t cell therapy": "CAR-T 세포치료제",
  "monoclonal antibody": "단클론항체",
  "bispecific antibody": "이중특이항체",
  "rnai": "RNAi",
  "gene editing": "유전자편집",
  "small molecules": "소분자 화합물",
  "small molecule": "소분자 화합물",
  "protein degraders": "단백질 분해제",
  "cell therapies": "세포치료제",
  "cell therapy": "세포치료제",
  "vaccines": "백신",
  "vaccine": "백신",
  "mrna therapies": "mRNA 치료제",
  "mrna therapy": "mRNA 치료제",
  "mrna": "mRNA 치료제",
  "antibody-drug conjugate": "항체-약물접합체(ADC)",
  "adc": "항체-약물접합체(ADC)",
  "t-cell engager": "T세포 관여 항체",
  "ai": "AI 신약개발",
  "glp-1 receptor agonist": "GLP-1 수용체 작용제",
};

// Indication translation map
const INDICATION_TRANSLATIONS: Record<string, string> = {
  "oncology": "항암",
  "immunology and autoimmune diseases": "면역·자가면역",
  "immunology": "면역",
  "autoimmune diseases": "자가면역",
  "endocrinology and metabolic disorders": "내분비·대사",
  "neurology": "신경",
  "infectious diseases": "감염",
  "inflammatory diseases": "염증",
  "gastroenterology": "소화기",
  "hepatology": "간질환",
  "musculoskeletal diseases": "근골격",
  "respiratory": "호흡기",
  "cardiovascular": "심혈관",
  "rare diseases": "희귀질환",
  "dermatology": "피부",
  "ophthalmology": "안과",
  "hematology": "혈액",
};

function translateTech(tech: string): string {
  if (!tech) return "";
  const lower = tech.toLowerCase().trim();
  return TECH_TRANSLATIONS[lower] || tech;
}

function translateIndication(area: string): string {
  if (!area) return "";
  // Split by comma and translate each
  const parts = area.split(",").map(p => p.trim()).filter(Boolean);
  const translated = parts.map(p => {
    const lower = p.toLowerCase();
    for (const [key, val] of Object.entries(INDICATION_TRANSLATIONS)) {
      if (lower.includes(key)) return val;
    }
    return p;
  });
  // Deduplicate
  const unique = [...new Set(translated)];
  return unique.join("·");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    console.log("Scraping Labiotech deals tracker...");

    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.labiotech.eu/biotech-deals-2026/", formats: ["markdown"], onlyMainContent: true }),
    });

    if (!resp.ok) throw new Error(`Firecrawl error: ${resp.status}`);
    const scraped = await resp.json();
    const markdown = scraped.data?.markdown || scraped.markdown || "";

    // Parse the table from markdown
    const tableMatch = markdown.match(/\| Date.*?\n\|[\s-|]+\n([\s\S]*?)(?:\n\n|\nNo results)/);
    if (!tableMatch) {
      console.log("No table found in markdown");
      return new Response(JSON.stringify({ success: true, deals: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = tableMatch[1].split("\n").filter((r: string) => r.includes("|") && r.includes("Date"));
    const deals: any[] = [];

    for (const row of rows) {
      // Parse: | Date<br>Feb 09, 2026 | Payer<br>Lilly | Country payer<br>United States | ...
      const cells = row.split("|").map((c: string) => c.trim()).filter(Boolean);
      if (cells.length < 9) continue;

      const extractVal = (cell: string) => {
        const brMatch = cell.match(/<br>(.*)/);
        return brMatch ? brMatch[1].trim() : cell.trim();
      };

      const dateStr = extractVal(cells[0]);
      const payer = extractVal(cells[1]);
      const payerCountry = countryToCode(extractVal(cells[2]));
      const payee = extractVal(cells[3]);
      const payeeCountry = countryToCode(extractVal(cells[4]));
      const totalStr = extractVal(cells[7]);
      const dealType = extractVal(cells[8]);
      const technology = translateTech(extractVal(cells[9]) || "");
      const indication = translateIndication(extractVal(cells[10]) || "");

      // Parse date
      const dateMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s*(\d{4})/);
      if (!dateMatch) continue;

      const monthMap: Record<string, string> = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
      const isoDate = `${dateMatch[3]}-${monthMap[dateMatch[1]]}-${dateMatch[2].padStart(2, "0")}`;

      const totalM = parseFloat(totalStr.replace(/[^0-9.]/g, "")) || 0;
      if (!payer || !payee || totalM === 0) continue;

      deals.push({ date: isoDate, payer, payer_country: payerCountry, payee, payee_country: payeeCountry, total_m: totalM, deal_type: dealType.includes("M&A") ? "M&A" : "Licensing", technology, indication });
    }

    console.log(`Parsed ${deals.length} deals`);

    // Upsert deals
    let inserted = 0;
    for (const deal of deals) {
      const { error } = await supabase.from("biotech_deals").upsert(deal, { onConflict: "payer,payee,date", ignoreDuplicates: false });
      if (!error) inserted++;
      else console.error(`Upsert error: ${error.message}`);
    }

    console.log(`Upserted ${inserted} deals`);
    return new Response(JSON.stringify({ success: true, parsed: deals.length, upserted: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("crawl-deals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
