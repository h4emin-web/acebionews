const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CnnArticle {
  title: string;
  url: string;
  imageUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const res = await fetch("https://edition.cnn.com/health", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) throw new Error(`CNN fetch failed: ${res.status}`);

    const html = await res.text();
    const articles: CnnArticle[] = [];
    const seenUrls = new Set<string>();

    // 이미지 URL 맵 — URL 경로 → 이미지 src 미리 수집
    const imgMap = new Map<string, string>();
    const imgBlockRegex = /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[\s\S]{0,800}?src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/g;
    let imgMatch;
    while ((imgMatch = imgBlockRegex.exec(html)) !== null) {
      const path = imgMatch[1];
      if (!imgMap.has(path)) imgMap.set(path, imgMatch[2]);
    }

    // 헤드라인 추출 — container__headline-text 패턴
    const headlineRegex = /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*container__headline-text[^"]*"[^>]*>\s*([^<]{10,})\s*<\/span>/g;
    let match;
    while ((match = headlineRegex.exec(html)) !== null) {
      const path = match[1];
      const url = `https://edition.cnn.com${path}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      articles.push({ title: match[2].trim(), url, imageUrl: imgMap.get(path) });
      if (articles.length >= 15) break;
    }

    // Fallback: data-zjs-headline
    if (articles.length < 5) {
      const fallback = /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[^>]*data-zjs-headline="([^"]{10,})"/g;
      while ((match = fallback.exec(html)) !== null) {
        const path = match[1];
        const url = `https://edition.cnn.com${path}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        articles.push({ title: match[2].trim(), url, imageUrl: imgMap.get(path) });
        if (articles.length >= 15) break;
      }
    }

    // Fallback 2: any span near health links
    if (articles.length < 3) {
      const simple = /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[\s\S]{0,300}?<span[^>]*>([^<]{15,})<\/span>/g;
      while ((match = simple.exec(html)) !== null) {
        const path = match[1];
        const url = `https://edition.cnn.com${path}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        articles.push({ title: match[2].trim(), url, imageUrl: imgMap.get(path) });
        if (articles.length >= 15) break;
      }
    }

    // featured 이미지 없으면 첫 번째 CNN 미디어 이미지로 보완
    if (articles.length > 0 && !articles[0].imageUrl) {
      const firstImg = /src="(https:\/\/media\.cnn\.com\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/.exec(html);
      if (firstImg) articles[0].imageUrl = firstImg[1];
    }

    return new Response(JSON.stringify({ success: true, articles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error crawling CNN Health:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
