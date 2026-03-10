const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CnnArticle {
  title: string;
  url: string;
  imageUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const res = await fetch("https://edition.cnn.com/health", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`CNN fetch failed: ${res.status}`);
    }

    const html = await res.text();
    const articles: CnnArticle[] = [];

    // Extract articles from CNN HTML using regex patterns
    // Look for container__link patterns with headlines
    const linkPattern =
      /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"/g;
    const titlePattern =
      /<span[^>]*class="[^"]*headline[^"]*"[^>]*>([^<]+)<\/span>/g;

    // Method 1: Extract from data-zjs-headline or headline spans
    const headlineRegex =
      /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*>([^<]{10,})<\/span>/g;
    let match;

    const seenUrls = new Set<string>();

    // Try to find article cards with images
    const cardRegex =
      /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[\s\S]*?(?:src="(https:\/\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)")?[\s\S]*?<span[^>]*>([^<]{15,})<\/span>/g;

    while ((match = cardRegex.exec(html)) !== null) {
      const url = `https://edition.cnn.com${match[1]}`;
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      articles.push({
        title: match[3].trim(),
        url,
        imageUrl: match[2] || undefined,
      });
      if (articles.length >= 15) break;
    }

    // Fallback: simpler extraction
    if (articles.length < 5) {
      const simpleRegex =
        /data-link-type="article"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*container__headline-text[^"]*"[^>]*>([^<]+)<\/span>/g;
      while ((match = simpleRegex.exec(html)) !== null) {
        const rawUrl = match[1];
        const url = rawUrl.startsWith("http")
          ? rawUrl
          : `https://edition.cnn.com${rawUrl}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        articles.push({ title: match[2].trim(), url });
        if (articles.length >= 15) break;
      }
    }

    // Fallback 2: any health article links with nearby text
    if (articles.length < 3) {
      const fallbackRegex =
        /href="(\/\d{4}\/\d{2}\/\d{2}\/health\/[^"]+)"[^>]*>[^<]*<[^>]*>([^<]{15,})</g;
      while ((match = fallbackRegex.exec(html)) !== null) {
        const url = `https://edition.cnn.com${match[1]}`;
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        articles.push({ title: match[2].trim(), url });
        if (articles.length >= 15) break;
      }
    }

    // Extract images separately and try to match
    if (articles.length > 0 && !articles[0].imageUrl) {
      const imgRegex =
        /src="(https:\/\/media\.cnn\.com\/[^"]*\.(?:jpg|jpeg|png|webp)[^"]*)"/g;
      const firstImg = imgRegex.exec(html);
      if (firstImg) {
        articles[0].imageUrl = firstImg[1];
      }
    }

    return new Response(JSON.stringify({ success: true, articles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error crawling CNN Health:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
