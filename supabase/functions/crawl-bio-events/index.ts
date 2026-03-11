const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BioEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  url?: string;
  category: "conference" | "fda" | "earnings" | "other";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const events: BioEvent[] = [];
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    // ── BioPharma Catalyst 크롤링 (FDA 일정) ──
    try {
      const fdaRes = await fetch("https://www.biopharmcatalyst.com/calendars/fda-calendar", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (fdaRes.ok) {
        const html = await fdaRes.text();
        // PDUFA 날짜 패턴
        const pdufaRegex = /(\d{1,2}\/\d{1,2}\/\d{4})[^<]*<[^>]*>[^<]*<\/[^>]*>[^<]*([A-Z][^<]{5,60})\s*(?:PDUFA|FDA|BLA|NDA)/g;
        let m;
        while ((m = pdufaRegex.exec(html)) !== null && events.filter(e => e.category === "fda").length < 10) {
          const [month, day, year] = m[1].split("/");
          const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
          if (dateStr < today.toISOString().split("T")[0]) continue;
          events.push({
            id: `fda-${dateStr}-${events.length}`,
            title: m[2].trim(),
            date: dateStr,
            category: "fda",
            url: "https://www.biopharmcatalyst.com/calendars/fda-calendar",
          });
        }
      }
    } catch (e) { console.error("FDA calendar error:", e); }

    // ── BioSpace 학회 일정 크롤링 ──
    try {
      const confRes = await fetch("https://www.biospace.com/events/", {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (confRes.ok) {
        const html = await confRes.text();
        // 이벤트 카드 패턴
        const eventRegex = /href="(\/events\/[^"]+)"[^>]*>[\s\S]{0,500}?<h[23][^>]*>([^<]{10,80})<\/h[23]>[\s\S]{0,300}?(\w+ \d{1,2}(?:[-–]\d{1,2})?,?\s*\d{4})/g;
        let m;
        const months: Record<string, string> = {
          January:"01",February:"02",March:"03",April:"04",May:"05",June:"06",
          July:"07",August:"08",September:"09",October:"10",November:"11",December:"12"
        };
        while ((m = eventRegex.exec(html)) !== null && events.filter(e => e.category === "conference").length < 12) {
          const dateRaw = m[3].trim();
          const dm = /(\w+)\s+(\d{1,2}).*?(\d{4})/.exec(dateRaw);
          if (!dm || !months[dm[1]]) continue;
          const dateStr = `${dm[3]}-${months[dm[1]]}-${dm[2].padStart(2, "0")}`;
          if (dateStr < today.toISOString().split("T")[0]) continue;
          events.push({
            id: `conf-${dateStr}-${events.length}`,
            title: m[2].trim(),
            date: dateStr,
            category: "conference",
            url: `https://www.biospace.com${m[1]}`,
          });
        }
      }
    } catch (e) { console.error("BioSpace events error:", e); }

    // 주요 고정 이벤트 (원료의약품/API 산업 중심)
    const year = today.getFullYear();
    const todayStr = today.toISOString().split("T")[0];
    const fixedEvents: BioEvent[] = ([
      // ── 원료의약품(API) / CPhI 관련 ──
      { id: "cphi-na-2025", title: "CPhI North America 2025", date: `${year}-05-06`, location: "Philadelphia, PA", category: "conference", url: "https://www.cphi.com/north-america/" },
      { id: "cphi-ww-2025", title: "CPhI Worldwide 2025", date: `${year}-10-07`, location: "Milan, Italy", category: "conference", url: "https://www.cphi.com/europe/" },
      { id: "cphi-sea-2025", title: "CPhI South East Asia 2025", date: `${year}-03-12`, location: "Bangkok, Thailand", category: "conference", url: "https://www.cphi.com/sea/" },
      { id: "cphi-japan-2025", title: "CPhI Japan 2025", date: `${year}-04-16`, location: "Tokyo, Japan", category: "conference", url: "https://www.cphi.com/japan/" },
      { id: "cphi-korea-2025", title: "CPhI Korea 2025", date: `${year}-08-26`, location: "Seoul, Korea", category: "conference", url: "https://www.cphi.com/korea/" },
      { id: "cphi-china-2025", title: "CPhI China 2025", date: `${year}-06-18`, location: "Shanghai, China", category: "conference", url: "https://www.cphi.com/china/" },
      { id: "cphi-india-2025", title: "CPhI & PMEC India 2025", date: `${year}-11-25`, location: "New Delhi, India", category: "conference", url: "https://www.cphi.com/india/" },
      // ── API/제네릭/CDMO 관련 ──
      { id: "apimf-2025", title: "APIMF Annual Meeting 2025", date: `${year}-06-03`, location: "Barcelona, Spain", category: "conference", url: "https://apimf.org" },
      { id: "dcat-2025", title: "DCAT Week 2025", date: `${year}-03-24`, location: "New York, NY", category: "conference", url: "https://www.dcatwk.com" },
      { id: "informex-2025", title: "INFORMEX / CPhI Active 2025", date: `${year}-05-06`, location: "Philadelphia, PA", category: "conference", url: "https://www.informex.com" },
      { id: "acs-2025", title: "ACS Spring Meeting 2025", date: `${year}-03-23`, location: "San Diego, CA", category: "conference", url: "https://www.acs.org" },
      { id: "excipact-2025", title: "ExciPACT Conference 2025", date: `${year}-09-15`, location: "Frankfurt, Germany", category: "conference", url: "https://www.excipact.org" },
      // ── 주요 바이오/제약 학회 ──
      { id: "asco-2025", title: "ASCO Annual Meeting 2025", date: `${year}-05-30`, location: "Chicago, IL", category: "conference", url: "https://www.asco.org" },
      { id: "bio-2025", title: "BIO International Convention 2025", date: `${year}-06-16`, location: "Boston, MA", category: "conference", url: "https://www.bio.org" },
      { id: "esmo-2025", title: "ESMO Congress 2025", date: `${year}-09-12`, location: "Berlin, Germany", category: "conference", url: "https://www.esmo.org" },
      { id: "ash-2025", title: "ASH Annual Meeting 2025", date: `${year}-12-06`, location: "Orlando, FL", category: "conference", url: "https://www.hematology.org" },
      { id: "jpmorgan-2026", title: "J.P. Morgan Healthcare Conference", date: `${year + 1}-01-12`, location: "San Francisco, CA", category: "conference", url: "https://www.jpmorgan.com" },
    ] as BioEvent[]).filter(e => e.date >= todayStr);
    
    // 고정 이벤트 중 크롤링에서 이미 가져온 것과 중복되지 않는 것만 추가
    const existingTitles = new Set(events.map(e => e.title.toLowerCase()));
    fixedEvents.forEach(fe => {
      if (!existingTitles.has(fe.title.toLowerCase())) {
        events.push(fe);
      }
    });

    // 날짜순 정렬
    events.sort((a, b) => a.date.localeCompare(b.date));

    return new Response(JSON.stringify({ success: true, events: events.slice(0, 30) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Bio events error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
