import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// RSS feed sources
const RSS_SOURCES = [
  { rss: "https://www.fiercepharma.com/rss/xml", name: "FiercePharma", region: "해외", country: "US" },
  { rss: "https://www.pharmaceutical-technology.com/feed/", name: "Pharma Technology", region: "해외", country: "EU" },
  { rss: "https://www.expresspharma.in/feed/", name: "Express Pharma", region: "해외", country: "IN" },
  { rss: "https://www.biopharmadive.com/feeds/news/", name: "BioPharma Dive", region: "해외", country: "US" },
  { rss: "https://www.pharmatimes.com/rss", name: "PharmaTimes", region: "해외", country: "US" },
];

// HTML sources — 약업신문 & 데일리팜 + 의약뉴스 + 히트뉴스 + fallback overseas
const HTML_SOURCES = [
  { url: "https://www.yakup.com/news/index.html?cat=12", name: "약업신문", region: "국내", country: "KR", parser: "yakup" },
  { url: "https://www.dailypharm.com/user/news?group=%EC%A2%85%ED%95%A9", name: "데일리팜", region: "국내", country: "KR", parser: "dailypharm" },
  { url: "https://www.dailypharm.com/user/news?group=%EC%A2%85%ED%95%A9&page=2", name: "데일리팜", region: "국내", country: "KR", parser: "dailypharm" },
  { url: "https://www.newsmp.com/news/articleList.html?sc_section_code=S1N2&view_type=sm", name: "의약뉴스", region: "국내", country: "KR", parser: "newsmp" },
  { url: "https://www.hitnews.co.kr/news/articleList.html?view_type=sm", name: "히트뉴스", region: "국내", country: "KR", parser: "hitnews" },
  { url: "https://www.kpanews.co.kr/news/articleList.html?sc_section_code=S1N4&view_type=sm", name: "약사공론", region: "국내", country: "KR", parser: "kpanews" },
  { url: "https://www.pharmnews.com/news/articleList.html?view_type=sm", name: "팜뉴스", region: "국내", country: "KR", parser: "pharmnews" },

  { url: "https://pharma.economictimes.indiatimes.com", name: "ET Pharma India", region: "해외", country: "IN", parser: "generic" },
  { url: "https://www.yakuji.co.jp/entrycategory/6", name: "薬事日報", region: "해외", country: "JP", parser: "yakuji" },
];

// Firecrawl sources — SPA sites that need JS rendering
const FIRECRAWL_SOURCES = [
  { url: "https://bydrug.pharmcube.com/news/summary/source/%E8%8D%AF%E6%B8%A1", name: "药渡", region: "해외", country: "CN", parser: "bydrug" },
  { url: "https://bydrug.pharmcube.com/news/summary/source/%E5%8C%BB%E8%8D%AF%E7%AC%94%E8%AE%B0", name: "医药笔记", region: "해외", country: "CN", parser: "bydrug" },
  { url: "https://bydrug.pharmcube.com/news/summary/source/%E8%8D%AF%E4%BA%8B%E7%BA%B5%E6%A8%AA", name: "药事纵横", region: "해외", country: "CN", parser: "bydrug" },
  { url: "https://www.reuters.com/business/healthcare-pharmaceuticals/", name: "Reuters Healthcare", region: "해외", country: "US", parser: "reuters" },
  { url: "https://www.asahi.com/apital/medicalnews/?iref=pc_apital_top", name: "朝日新聞 Apital", region: "해외", country: "JP", parser: "asahi" },
  { url: "https://news.web.nhk.or.jp/newsweb/pl/news-nwa-topic-nationwide-0000414", name: "NHK 医療", region: "해외", country: "JP", parser: "nhk" },
];

function normalizeDate(dateStr?: string): string {
  if (dateStr) {
    const isoMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    }
    const dotMatch = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (dotMatch) {
      return `${dotMatch[1]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[3].padStart(2, "0")}`;
    }
    // Short format like "02.16 06:00" — assume current year
    const shortMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\s/);
    if (shortMatch) {
      const year = new Date().getFullYear();
      return `${year}-${shortMatch[1].padStart(2, "0")}-${shortMatch[2].padStart(2, "0")}`;
    }
  }
  // Fallback: today's date (KST)
  return new Date().toISOString().split("T")[0];
}

function stripCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse RSS XML into articles
function parseRss(xml: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const items: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>|<entry[\s>]([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
    const block = match[1] || match[2] || "";
    const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descM = block.match(/<description[^>]*>([\s\S]*?)<\/description>|<summary[^>]*>([\s\S]*?)<\/summary>|<content[^>]*>([\s\S]*?)<\/content>/i);
    const linkM = block.match(/<link[^>]*>([\s\S]*?)<\/link>|<link[^>]*href="([^"]*?)"/i);
    const dateM = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>|<published[^>]*>([\s\S]*?)<\/published>|<dc:date[^>]*>([\s\S]*?)<\/dc:date>|<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const title = stripHtml(stripCdata(titleM?.[1] || ""));
    const summary = stripHtml(stripCdata(descM?.[1] || descM?.[2] || descM?.[3] || "")).slice(0, 300);
    const url = stripCdata(linkM?.[1] || linkM?.[2] || "").trim();
    const date = stripCdata(dateM?.[1] || dateM?.[2] || dateM?.[3] || dateM?.[4] || "");
    if (title) {
      items.push({ title, summary, url, date: normalizeDate(date) });
    }
  }
  return items;
}

// Fetch RSS feed
async function fetchRss(source: typeof RSS_SOURCES[0]): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    console.log(`Fetching RSS: ${source.name}`);
    const resp = await fetch(source.rss, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsCrawler/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      console.error(`RSS fetch failed for ${source.name}: ${resp.status}`);
      return [];
    }
    const xml = await resp.text();
    const articles = parseRss(xml);
    console.log(`Parsed ${articles.length} articles from ${source.name} RSS`);
    return articles;
  } catch (err) {
    console.error(`RSS error for ${source.name}:`, err);
    return [];
  }
}

// Parse 약업신문 HTML
function parseYakup(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liBlocks = html.split(/<li>/gi);
  for (const block of liBlocks) {
    if (articles.length >= 15) break;
    const linkMatch = block.match(/href="([^"]*mode=view[^"]*)"/i);
    if (!linkMatch) continue;
    const url = linkMatch[1].replace(/&amp;/g, "&");
    const fullUrl = url.startsWith("http") ? url : `https://www.yakup.com${url}`;
    const titleMatch = block.match(/class="title_con">\s*<span>\s*([\s\S]*?)\s*<\/span>/i);
    if (!titleMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    const summaryMatch = block.match(/class="text_con">\s*<span>\s*([\s\S]*?)\s*<\/span>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/class="date">\s*([\d.]+)\s*<\/span>/i);
    const dateStr = dateMatch ? dateMatch[1].replace(/\./g, "-") : "";
    if (title.length > 5) {
      articles.push({ title, summary, url: fullUrl, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 데일리팜 HTML (종합뉴스 페이지)
function parseDailypharm(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  
  // Primary: match <li> blocks containing dailypharm news links
  const liParts = html.split(/<li\s[^>]*>/gi);
  for (let i = 1; i < liParts.length && articles.length < 30; i++) {
    const block = liParts[i];
    // Match any dailypharm news URL
    const urlMatch = block.match(/<a\s+href="((?:https:\/\/www\.dailypharm\.com)?\/user\/news\/\d+)"/i);
    if (!urlMatch) continue;
    let url = urlMatch[1];
    if (url.startsWith("/")) url = `https://www.dailypharm.com${url}`;
    
    const titleMatch = block.match(/<div\s+class="lin_title">([\s\S]*?)<\/div>/i);
    if (!titleMatch) continue;
    const title = stripHtml(titleMatch[1]).trim();
    const summaryMatch = block.match(/<div\s+class="lin_cont[^"]*">([\s\S]*?)<\/div>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/<div class="lin_data">\s*<div>(\d{4}-\d{2}-\d{2})/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5 && !articles.some(a => a.title === title)) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  
  // Fallback: try anchor tag pattern directly
  if (articles.length === 0) {
    console.log(`[데일리팜] Primary parser found 0 articles, trying fallback. HTML length: ${html.length}`);
    const linkRegex = /<a\s+href="((?:https:\/\/www\.dailypharm\.com)?\/user\/news\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null && articles.length < 30) {
      let url = m[1];
      if (url.startsWith("/")) url = `https://www.dailypharm.com${url}`;
      const title = stripHtml(m[2]).trim();
      if (title.length > 5 && !articles.some(a => a.url === url)) {
        articles.push({ title, summary: "", url, date: normalizeDate("") });
      }
    }
  }
  
  console.log(`[데일리팜] Extracted ${articles.length} articles`);
  return articles;
}

// Parse 의약뉴스 (newsmp.com) HTML
function parseNewsmp(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const blocks = html.split(/<!--\s*group\s*\/\/-->/gi);
  for (const block of blocks) {
    if (articles.length >= 15) break;
    const titleMatch = block.match(/<div class="list-titles">\s*<a[^>]*href="([^"]*)"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i);
    if (!titleMatch) continue;
    const rawUrl = titleMatch[1].trim();
    const url = rawUrl.startsWith("http") ? rawUrl : `https://www.newsmp.com${rawUrl}`;
    const title = stripHtml(titleMatch[2]).trim();
    const summaryMatch = block.match(/<p class="list-summary">\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/\|\s*(\d{4}-\d{2}-\d{2})\s/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 히트뉴스 (hitnews.co.kr) HTML
function parseHitnews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li>\s*<h4 class="titles">\s*<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/h4>[\s\S]*?<em class="info dated">([\s\S]*?)<\/em>[\s\S]*?<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    let url = m[1].trim();
    if (url.startsWith("/")) {
      url = `https://www.hitnews.co.kr${url}`;
    } else if (!url.startsWith("http")) {
      url = `https://www.hitnews.co.kr/${url}`;
    }
    const title = stripHtml(m[2]).trim();
    const dateStr = stripHtml(m[3]).trim();
    if (title.length > 5) {
      articles.push({ title, summary: "", url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse Reuters Healthcare (from Firecrawl markdown)
function parseReuters(markdown: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const lines = markdown.split("\n");

  const monthMap: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
    July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
  };

  for (let i = 0; i < lines.length && articles.length < 25; i++) {
    const line = lines[i].trim();

    // Match markdown links to reuters articles: [Title](url)
    const linkMatch = line.match(/\[([^\]]{10,})\]\((https:\/\/www\.reuters\.com\/[^)]+)\)/);
    if (!linkMatch) continue;
    const title = linkMatch[1].replace(/\*\*/g, "").trim();
    const url = linkMatch[2].trim();

    // Skip non-article links (events, tags, categories, images, differentiator, photos)
    if (url.includes("/tags/") || url.includes("/events/") || url.includes("/differentiator") 
        || url.includes("reutersevents.com") || url.includes("/pictures/") || url.includes("/graphics/")
        || url.includes("/slideshow/") || url.includes("/video/") || url.includes("/media/")
        || url.match(/\/\d{4}\/\d{2}\/\d{2}\/[^/]*photo[^/]*\//i)
        || title.includes("category") || title.length < 15
        || title.startsWith("Skip to") || title.includes("Reuters logo")
        || title.match(/^(Photo|Image|Picture|Gallery|Slideshow)/i)) continue;

    // Already have this URL?
    if (articles.some(a => a.url === url)) continue;

    // Look for date in nearby lines
    let dateStr = "";
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 5); j++) {
      const dl = lines[j].trim();
      // "February 23, 2026" format
      const fullDate = dl.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/);
      if (fullDate) {
        dateStr = `${fullDate[3]}-${monthMap[fullDate[1]]}-${fullDate[2].padStart(2, "0")}`;
        break;
      }
      // "X hours ago", "X mins ago" → today
      if (/\d+\s+(hours?|mins?|minutes?)\s+ago/i.test(dl)) {
        dateStr = normalizeDate("");
        break;
      }
    }
    if (!dateStr) dateStr = normalizeDate("");

    // Look for summary in nearby lines (paragraph text, not links)
    let summary = "";
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4); j++) {
      const sl = lines[j].trim();
      if (sl.length > 40 && !sl.startsWith("[") && !sl.startsWith("!") && !sl.startsWith("http") && !sl.includes("category")) {
        summary = sl.slice(0, 300);
        break;
      }
    }

    articles.push({ title, summary, url, date: dateStr });
  }
  console.log(`parseReuters: extracted ${articles.length} articles`);
  return articles;
}

// Parse 약사공론 (kpanews.co.kr) HTML
function parseKpanews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li class="altlist-webzine-item">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    const block = m[1];
    const titleMatch = block.match(/<h2 class="altlist-subject">\s*<a\s+href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleMatch) continue;
    const url = titleMatch[1].trim();
    const title = stripHtml(titleMatch[2]).trim();
    const summaryMatch = block.match(/<p class="altlist-summary">\s*([\s\S]*?)\s*<\/p>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/<div class="altlist-info-item">(\d{2}-\d{2}\s+\d{2}:\d{2})<\/div>/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 医薬ニュース (iyakunews.com) HTML
function parseIyakuNews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const parts = html.split(/class=['"]rss-site-item['"]/gi);
  for (let i = 1; i < parts.length && articles.length < 20; i++) {
    const block = parts[i];
    const urlMatch = block.match(/href=['"]([^'"]*)['"]/i);
    if (!urlMatch) continue;
    let url = urlMatch[1].replace(/&amp;/g, "&").trim();
    const googleRedirect = url.match(/[?&]url=([^&]+)/);
    if (googleRedirect) {
      url = decodeURIComponent(googleRedirect[1]);
    }
    const pMatch = block.match(/class=['"]title['"][^>]*>([\s\S]*?)<\/p>/i);
    if (!pMatch) continue;
    let titleRaw = pMatch[1]
      .replace(/<span[^>]*>.*?<\/span>/gi, "")
      .replace(/&lt;b&gt;/g, "").replace(/&lt;\/b&gt;/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .trim();
    const dateMatch = titleRaw.match(/\[(\d{4})\/(\d{2})\/(\d{2})\s+\d{2}:\d{2}\]/);
    let dateStr = "";
    if (dateMatch) {
      dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      titleRaw = titleRaw.replace(/\s*\[\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\]\s*/, "").trim();
    }
    titleRaw = titleRaw.replace(/\s*[ー－—]\s+[^\[]+$/, "").replace(/　$/, "").trim();
    if (titleRaw.length > 5) {
      articles.push({ title: titleRaw, summary: "", url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 팜뉴스 (pharmnews.com) HTML — same structure as kpanews (altlist-webzine)
function parsePharmnews(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li class="altlist-webzine-item">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    const block = m[1];
    const titleMatch = block.match(/<h2 class="altlist-subject">\s*<a\s+href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (!titleMatch) continue;
    const url = titleMatch[1].trim();
    const title = stripHtml(titleMatch[2]).replace(/&nbsp;/g, " ").trim();
    const summaryMatch = block.match(/<p class="altlist-summary">\s*([\s\S]*?)\s*<\/p>/i);
    const summary = summaryMatch ? stripHtml(summaryMatch[1]).slice(0, 300).trim() : "";
    const dateMatch = block.match(/<div class="altlist-info-item">(\d{2}-\d{2}\s+\d{2}:\d{2})<\/div>/i);
    const dateStr = dateMatch ? dateMatch[1] : "";
    if (title.length > 5) {
      articles.push({ title, summary, url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// Parse 薬事日報 (yakuji.co.jp) HTML
function parseYakuji(html: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const liRegex = /<li><a\s+href="(https:\/\/www\.yakuji\.co\.jp\/entry\d+\.html)">([\s\S]*?)<\/a>[\s\S]*?<span class="time-list">([\s\S]*?)<\/span><\/li>/gi;
  let m;
  while ((m = liRegex.exec(html)) !== null && articles.length < 20) {
    const url = m[1].trim();
    const title = stripHtml(m[2]).trim();
    const rawDate = stripHtml(m[3]).trim();
    // Parse "2026年02月24日 (火)" format
    const dateMatch = rawDate.match(/(\d{4})年(\d{2})月(\d{2})日/);
    const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "";
    if (title.length > 5) {
      articles.push({ title, summary: "", url, date: normalizeDate(dateStr) });
    }
  }
  return articles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse 医药新闻 (bydrug.pharmcube.com/news) from Firecrawl markdown
//
// 실제 URL 형식: https://bydrug.pharmcube.com/news/detail/{32자리 해시}
// 예: https://bydrug.pharmcube.com/news/detail/53cf6634c1e57f4bfe178ef684914ed3
//
// 날짜는 "2小时前", "1小时前" 같은 상대 시간으로 표시되므로 → today로 처리
// ─────────────────────────────────────────────────────────────────────────────
function parseBydrug(markdown: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const lines = markdown.split("\n");

  // bydrug URL 패턴 — 해시 길이 유동적 (32~64자)
  const BYDRUG_URL_RE = /https:\/\/bydrug\.pharmcube\.com\/news\/detail\/[a-f0-9]{20,}/;

  // 날짜 추출: "2026-02-24 16:26" 패턴 또는 상대시간 → today
  const extractDateNearLine = (idx: number, lookahead = 8): string => {
    for (let j = idx; j <= Math.min(lines.length - 1, idx + lookahead); j++) {
      const dm = lines[j].match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
      if (dm) return `${dm[1]}-${dm[2]}-${dm[3]}`;
      const cnDate = lines[j].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (cnDate) return `${cnDate[1]}-${cnDate[2].padStart(2, "0")}-${cnDate[3].padStart(2, "0")}`;
      // Relative time: "8小时前", "30分钟前" → today
      if (/\d+\s*小时前|\d+\s*分钟前/.test(lines[j])) return normalizeDate("");
    }
    return normalizeDate("");
  };

  const addArticle = (title: string, summary: string, url: string, dateStr: string) => {
    if (title.length < 5) return;
    if (!BYDRUG_URL_RE.test(url)) return;
    if (articles.some(a => a.url === url)) return;
    // 제목에서 불필요한 마크다운/이모지 제거
    title = title.replace(/\\/g, "").replace(/\*\*/g, "").replace(/^【[^】]*】/, "").trim();
    articles.push({ title, summary, url, date: dateStr || normalizeDate("") });
  };

  // 주요 패턴: [제목](url) 다음에 요약 텍스트, 그 다음에 소스+날짜
  for (let i = 0; i < lines.length && articles.length < 20; i++) {
    const line = lines[i].trim();

    // 마크다운 링크: [제목](bydrug url)
    const linkMatch = line.match(/^\[([^\]]{5,})\]\((https:\/\/bydrug\.pharmcube\.com\/news\/detail\/[a-f0-9]{20,})\)/);
    if (linkMatch) {
      const title = linkMatch[1];
      const url = linkMatch[2];
      // 다음 줄에 요약이 있을 수 있음
      let summary = "";
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.length > 10 && !nextLine.startsWith("[") && !nextLine.startsWith("!") && !BYDRUG_URL_RE.test(nextLine)) {
          summary = nextLine.slice(0, 300);
        }
      }
      addArticle(title, summary, url, extractDateNearLine(i, 10));
      continue;
    }

    // fallback: URL이 포함된 라인
    const urlMatch = line.match(BYDRUG_URL_RE);
    if (!urlMatch) continue;
    const url = urlMatch[0];

    // 같은 라인의 인라인 링크
    const inlineLink = line.match(/\[([^\]]{5,})\]\(https:\/\/bydrug/);
    if (inlineLink) {
      addArticle(inlineLink[1], "", url, extractDateNearLine(i, 10));
      continue;
    }

    // 이전 라인에서 제목 찾기
    if (i > 0) {
      const prevLine = lines[i - 1].trim();
      if (prevLine.length >= 5 && !prevLine.startsWith("http") && !prevLine.startsWith("|") && !prevLine.startsWith("!")) {
        addArticle(stripHtml(prevLine), "", url, extractDateNearLine(i, 10));
      }
    }
  }

  console.log(`parseBydrug: extracted ${articles.length} articles`);
  return articles;
}


// Parse 朝日新聞 Apital (from Firecrawl markdown)
function parseAsahi(markdown: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (articles.length >= 20) break;
    const match = line.match(
      /\[\*\*(.+?)\*\*\s*(\d{1,2})\/(\d{1,2})\([^)]*\)\s*[\d:]*\]\((https:\/\/www\.asahi\.com\/articles\/[^)]+)\)/
    );
    if (!match) continue;
    const title = match[1].trim();
    const monthStr = match[2].padStart(2, "0");
    const dayStr = match[3].padStart(2, "0");
    const url = match[4].trim();
    const year = new Date().getFullYear();
    const date = `${year}-${monthStr}-${dayStr}`;
    if (title.length > 5 && !articles.some(a => a.url === url)) {
      articles.push({ title, summary: "", url, date });
    }
  }
  return articles;
}

// Parse NHK 医療 (from Firecrawl markdown)
function parseNhk(markdown: string): Array<{ title: string; summary: string; url: string; date: string }> {
  const articles: Array<{ title: string; summary: string; url: string; date: string }> = [];
  const lines = markdown.split("\n");

  for (let i = 0; i < lines.length && articles.length < 20; i++) {
    const line = lines[i].trim();
    const titleMatch = line.match(/\*\*(.{5,})\*\*/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    let url = "";
    let dateStr = "";
    for (let j = Math.max(0, i - 5); j <= Math.min(lines.length - 1, i + 5); j++) {
      const urlMatch = lines[j].match(/\((https?:\/\/news\.web\.nhk[^)]+)\)/);
      if (urlMatch && !url) url = urlMatch[1].trim();
      const dateMatch = lines[j].match(/(\d{1,2})月(\d{1,2})日/);
      if (dateMatch && !dateStr) {
        const year = new Date().getFullYear();
        dateStr = `${year}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
      }
    }
    if (!url || !title) continue;
    if (!dateStr) dateStr = normalizeDate("");
    if (!articles.some(a => a.url === url)) {
      articles.push({ title, summary: "", url, date: dateStr });
    }
  }
  return articles;
}

// Fetch SPA sites using Firecrawl scrape API
async function fetchWithFirecrawl(
  source: typeof FIRECRAWL_SOURCES[0]
): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      console.error("FIRECRAWL_API_KEY not configured, skipping Firecrawl sources");
      return [];
    }

    console.log(`Fetching via Firecrawl: ${source.name}`);
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: source.url,
        formats: ["markdown"],
        waitFor: 3000,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      console.error(`Firecrawl fetch failed for ${source.name}: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    const markdown = data.data?.markdown || data.markdown || "";

    // DEBUG: Supabase 로그에서 마크다운 구조를 확인할 수 있도록 첫 500자 출력
    console.log(`[${source.name}] Firecrawl markdown preview:\n${markdown.slice(0, 500)}`);

    let articles: Array<{ title: string; summary: string; url: string; date: string }> = [];

    if (source.parser === "bydrug") {
      // ✅ "By Drug" → "bydrug"으로 통일됨
      articles = parseBydrug(markdown);
    } else if (source.parser === "reuters") {
      articles = parseReuters(markdown);
    } else if (source.parser === "asahi") {
      articles = parseAsahi(markdown);
    } else if (source.parser === "nhk") {
      articles = parseNhk(markdown);
    }

    console.log(`Extracted ${articles.length} articles from ${source.name} via Firecrawl`);
    return articles;
  } catch (err) {
    console.error(`Firecrawl error for ${source.name}:`, err);
    return [];
  }
}

// Fetch HTML and parse based on parser type
async function fetchHtml(
  source: typeof HTML_SOURCES[0]
): Promise<Array<{ title: string; summary: string; url: string; date: string }>> {
  try {
    console.log(`Fetching HTML: ${source.name}`);
    const resp = await fetch(source.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": source.url,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      console.error(`HTML fetch failed for ${source.name}: ${resp.status}`);
      return [];
    }
    const html = await resp.text();

    let articles: Array<{ title: string; summary: string; url: string; date: string }> = [];

    if (source.parser === "yakup") {
      articles = parseYakup(html);
    } else if (source.parser === "dailypharm") {
      articles = parseDailypharm(html);
    } else if (source.parser === "newsmp") {
      articles = parseNewsmp(html);
    } else if (source.parser === "hitnews") {
      articles = parseHitnews(html);
    } else if (source.parser === "kpanews") {
      articles = parseKpanews(html);
    } else if (source.parser === "pharmnews") {
      articles = parsePharmnews(html);
    } else if (source.parser === "answersnews" || source.parser === "iyakunews") {
      articles = parseIyakuNews(html);
    } else if (source.parser === "yakuji") {
      articles = parseYakuji(html);
      // Generic fallback
      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let lm;
      while ((lm = linkRegex.exec(html)) !== null && articles.length < 10) {
        const href = lm[1];
        const text = stripHtml(lm[2]).trim();
        if (text.length > 20 && text.length < 200 && !href.includes("javascript:")) {
          const fullUrl = href.startsWith("http") ? href : `${source.url}${href.startsWith("/") ? "" : "/"}${href}`;
          articles.push({ title: text, summary: "", url: fullUrl, date: normalizeDate("") });
        }
      }
    }

    console.log(`Extracted ${articles.length} articles from ${source.name} HTML`);
    return articles;
  } catch (err) {
    console.error(`HTML error for ${source.name}:`, err);
    return [];
  }
}

// Fetch full body text for ALL foreign articles using Firecrawl
async function enrichForeignArticles(
  articles: Array<{ title: string; summary: string; source: string; region: string; country: string; url: string; date: string }>
): Promise<void> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return;

  // Enrich ALL overseas articles, not just Chinese ones
  const foreignArticles = articles.filter(a => a.region === "해외");
  if (foreignArticles.length === 0) return;

  // Scrape up to 30 articles (batches of 5 to avoid rate limits)
  const toScrape = foreignArticles.slice(0, 30);
  console.log(`Enriching ${toScrape.length} foreign articles with full body text`);

  for (let i = 0; i < toScrape.length; i += 5) {
    const batch = toScrape.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (article) => {
        try {
          const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: article.url, formats: ["markdown"], onlyMainContent: true }),
            signal: AbortSignal.timeout(15000),
          });
          if (!resp.ok) return null;
          const data = await resp.json();
          const md = data.data?.markdown || data.markdown || "";
          // Extract the main content paragraphs (skip nav/header/footer lines)
          const lines = md.split("\n").filter((l: string) => {
            const t = l.trim();
            return t.length > 30 && !t.startsWith("!") && !t.startsWith("[") && !t.startsWith("http") 
              && !t.includes("版权声明") && !t.includes("登录") && !t.includes("Subscribe")
              && !t.includes("Sign up") && !t.includes("Cookie") && !t.includes("Privacy Policy")
              && !t.includes("newsletter") && !t.includes("Advertisement");
          });
          return { url: article.url, body: lines.join("\n").slice(0, 2000) };
        } catch {
          return null;
        }
      })
    );

    for (const r of results) {
      if (!r || !r.body || r.body.length < 50) continue;
      const article = articles.find(a => a.url === r.url);
      if (article) {
        article.summary = r.body; // Replace short summary with full body text for AI processing
      }
    }

    if (i + 5 < toScrape.length) await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`Enriched ${toScrape.length} foreign articles with body text`);
}

// Use Gemini API to extract keywords AND translate/summarize foreign articles
async function extractKeywordsAndTranslate(
  articles: Array<{ title: string; summary: string; source: string; region: string; country: string; url: string; date: string }>,
  GOOGLE_GEMINI_API_KEY: string
): Promise<any[]> {
  if (articles.length === 0) return [];

  const articleList = articles.map((a, i) => `[${i}] ${a.title} | ${a.summary}`).join("\n");

  try {
    const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a pharmaceutical news analyst specializing in Active Pharmaceutical Ingredients (APIs/원료의약품).

## TASK 1: KEYWORD EXTRACTION
- apiKeywords MUST contain ingredient/compound names that are EXPLICITLY written in the article title or summary.
- DO NOT guess, infer, or hallucinate ingredient names that are NOT in the text.
- If an article only mentions a brand name without its active ingredient, set apiKeywords to [].
- Valid keywords: small-molecule compounds, biologics, any INN or chemical name explicitly stated.
- **CRITICAL FORMAT RULE (applies to ALL articles — every country, every language, NO exceptions):**
  - Every keyword MUST be in the format: "한글명 (English Name)"
  - Examples: "세마글루타이드 (Semaglutide)", "리바록사반 (Rivaroxaban)", "트라스투주맙 (Trastuzumab)"
  - If the article is in English, translate the ingredient name to Korean and put it first: "오젬픽 → 세마글루타이드 (Semaglutide)"
  - If the article is in Japanese/Chinese, translate the ingredient name to Korean: "リバーロキサバン → 리바록사반 (Rivaroxaban)"
  - NEVER return English-only keywords like "Semaglutide" or Korean-only keywords like "세마글루타이드"
- INVALID: Brand/product names only, generic categories (엑소좀, mRNA, GLP-1, siRNA, 백신), mechanism names.

## CRITICAL: TITLE FORMATTING
- NEVER add [국내], [해외], (국내), (해외) prefixes to translated_title. Return ONLY the article title without any region tags.

## TASK 2: TRANSLATION & SUMMARY (MANDATORY)
- **CRITICAL: You MUST translate ALL foreign articles. This is NOT optional.**
- For foreign articles, you MUST provide:
  - translated_title: Korean translation of the title. NEVER leave this empty. NEVER add [국내]/[해외]/(국내)/(해외) prefixes.
  - translated_summary: Korean summary with KEY FACTS. Include specific numbers, company names, drug names, indications, and important details. 존댓말(~입니다, ~됩니다) 사용. 3-4 sentences for articles with rich content.
- **CRITICAL: Do NOT write vague summaries like "중요한 성과를 기록했습니다" — always include the SPECIFIC details (what company, what drug, what numbers, what market).**
- For Korean articles:
  - translated_title: set to the original Korean title AS-IS. NEVER add [국내]/[해외]/(국내)/(해외) prefixes.
  - translated_summary: 기사 핵심 내용을 구체적 수치와 사실 중심으로 3~4문장 이내로 요약. 존댓말(~입니다, ~됩니다) 사용. "~이다", "~했다" 등 반말 사용 금지.

## TASK 3: 요약 내 생소한 용어 보충 설명 (IMPORTANT)
- translated_summary를 작성할 때, 독자가 모를 수 있는 전문 용어·약물명·기술명이 등장하면 **요약 문장 안에서** 자연스럽게 설명을 포함하세요.
- 방법: 괄호 삽입, 또는 문장 자체에 녹여서 설명. 요약 뒤에 별도 문장을 덧붙이는 것도 가능.
- 예시 1: "iPS세포(유도만능줄기세포)를 활용한 파킨슨병 치료제와 혈소판 제제가 심의에 들어갔으며, 승인될 경우 세계 최초 iPS 유래 의료제품이 됩니다."
- 예시 2: "리툭산(성분명: 리툭시맙, B세포 표적 항체 치료제)이 자가면역용혈성빈혈 적응증으로 허가를 받았습니다."
- 이미 요약만으로 내용이 충분히 이해되면 추가 설명 불필요.
- 핵심: 요약을 읽는 것만으로 "이게 뭐고, 어디에 쓰이는지" 바로 알 수 있어야 합니다.

## TASK 4: RELEVANCE FILTERING (CRITICAL)
- You MUST evaluate whether each article is relevant to the pharmaceutical/biotech/healthcare industry.
- Set is_relevant to true ONLY for articles about: drugs, medicines, APIs, biotech, clinical trials, FDA/regulatory, healthcare policy, medical devices, pharmaceutical companies, hospitals, diseases/treatments.
- Set is_relevant to false for articles about: food companies (Domino's, McDonald's etc.), general business/finance unrelated to pharma, sports, entertainment, politics (unless health policy), technology (unless biotech/medtech), retail, real estate, automotive, energy (unless related to pharma).
- When in doubt, set is_relevant to false. We only want pharmaceutical/biotech/healthcare news.

## Output: JSON array. Include ALL articles (even those with empty apiKeywords).
- category: 규제/시장/공급망/R&D/임상/허가`,
          },
          {
            role: "user",
            content: `Extract API keywords and translate foreign articles:\n\n${articleList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_keywords",
              description: "Extract API keywords and translate foreign news articles",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        apiKeywords: { type: "array", items: { type: "string" } },
                        category: { type: "string" },
                        is_relevant: { type: "boolean", description: "true if article is about pharma/biotech/healthcare, false otherwise" },
                        translated_title: { type: "string", description: "Korean translated title. REQUIRED for all articles." },
                        translated_summary: { type: "string", description: "Korean summary. REQUIRED for all articles." },
                      },
                      required: ["index", "apiKeywords", "category", "is_relevant", "translated_title", "translated_summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["results"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_keywords" } },
      }),
    });

    if (!aiResp.ok) {
      console.error(`Gemini API error: ${aiResp.status}`);
      if (aiResp.status === 429) {
        console.warn("Rate limited - skipping this batch");
      }
      return [];
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return [];

    const parsed = JSON.parse(toolCall.function.arguments);
    const results: any[] = [];

    for (const r of parsed.results || []) {
      const article = articles[r.index];
      if (!article) continue;

      // Skip irrelevant articles (e.g., Domino's Pizza, non-pharma news)
      if (r.is_relevant === false) {
        console.log(`Skipping irrelevant article: ${article.title}`);
        continue;
      }

      const isForeign = article.region === "해외";
      const langMap: Record<string, string> = { JP: "ja", CN: "zh", IN: "en", US: "en", EU: "en" };
      const origLang = isForeign ? (langMap[article.country] || "en") : "ko";
      // Strip region tags from title
      const stripRegionTag = (t: string) => t.replace(/^\s*[\[\(](국내|해외)[\]\)]\s*/g, "").trim();
      const finalTitle = stripRegionTag(r.translated_title || article.title);
      const finalSummary = r.translated_summary || article.summary;

      results.push({
        title: finalTitle,
        summary: finalSummary,
        source: article.source,
        region: article.region,
        country: article.country,
        url: article.url,
        date: article.date,
        api_keywords: r.apiKeywords || [],
        category: r.category || "",
        original_language: origLang,
      });
    }

    return results;
  } catch (err) {
    console.error("Keyword extraction error:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));

    // --- Backfill mode: fix keyword format to "한글명 (English Name)" ---
    if (body.backfillKeywords) {
      const { data: allArticles } = await supabase
        .from("news_articles")
        .select("id, api_keywords")
        .order("created_at", { ascending: false })
        .limit(500);

      const needsFix = (allArticles || []).filter((a: any) => {
        return (a.api_keywords || []).some((kw: string) => {
          const hasKorean = /[\uAC00-\uD7A3]/.test(kw);
          const startsWithEnglish = /^[a-zA-Z]/.test(kw);
          return !hasKorean || startsWithEnglish;
        });
      });
      console.log(`Found ${needsFix.length} articles with keywords needing format fix`);

      let fixed = 0;
      const kBatchSize = 10;
      for (let i = 0; i < needsFix.length; i += kBatchSize) {
        const batch = needsFix.slice(i, i + kBatchSize);
        const kwList = batch.map((a: any, idx: number) => `[${idx}] ${JSON.stringify(a.api_keywords)}`).join("\n");
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `제약 원료의약품 키워드 형식 전문가입니다. 각 키워드를 반드시 "한글명 (English Name)" 형식으로 변환하세요.
규칙:
- 영문만 있는 경우: 한국어 번역을 앞에 추가. 예: "Rivaroxaban" → "리바록사반 (Rivaroxaban)"
- 한글만 있는 경우: 영문명을 괄호 안에 추가. 예: "세마글루타이드" → "세마글루타이드 (Semaglutide)"
- "영문 (한글)" 형식인 경우: 순서를 바꿔서 "한글 (영문)"으로. 예: "Wegovy (위고비)" → "위고비 (Wegovy)"
- 이미 "한글 (영문)" 형식이면 그대로 유지
- 브랜드명은 그대로 한글화. 예: "Uplizna" → "유플리즈나 (Uplizna)"
- 코드명(JW0061 등)이나 카테고리(mRNA, GLP-1, siRNA)는 제외(빈 배열 반환)`,
                },
                { role: "user", content: `Fix keyword format:\n\n${kwList}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "fix_keywords",
                  description: "Fix keyword format",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number" },
                            keywords: { type: "array", items: { type: "string" } },
                          },
                          required: ["index", "keywords"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "fix_keywords" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.keywords) continue;
            await supabase.from("news_articles").update({ api_keywords: r.keywords }).eq("id", article.id);
            fixed++;
          }
        } catch (err) { console.error("Keyword fix batch error:", err); }
        if (i + kBatchSize < needsFix.length) await new Promise(r => setTimeout(r, 1500));
      }
      return new Response(
        JSON.stringify({ success: true, fixed, total: needsFix.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Backfill mode: translate existing foreign articles ---
    if (body.backfillTranslations) {
      const { data: foreignArticles } = await supabase
        .from("news_articles")
        .select("id, title, summary, region, country")
        .eq("region", "해외")
        .order("created_at", { ascending: false })
        .limit(200);

      const needsTranslation = (foreignArticles || []).filter((a: any) => {
        return /[a-zA-Z]{3,}/.test(a.title) || /[\u3040-\u309F\u30A0-\u30FF]/.test(a.title);
      });
      console.log(`Found ${needsTranslation.length} foreign articles needing translation`);

      let translated = 0;
      const tBatchSize = 5;
      for (let i = 0; i < needsTranslation.length; i += tBatchSize) {
        const batch = needsTranslation.slice(i, i + tBatchSize);
        const articleList = batch.map((a: any, idx: number) => `[${idx}] ${a.title} | ${a.summary?.slice(0, 200) || ""}`).join("\n");
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `제약/바이오 뉴스 번역 전문가입니다. 영어 또는 일본어 기사를 한국어로 번역하세요.\n- translated_title: 기사 제목을 한국어로 번역\n- translated_summary: 기사 핵심 내용을 한국어 2문장 이내로 요약. 존댓말(~입니다, ~됩니다) 사용.\n모든 기사에 대해 반드시 번역을 제공해야 합니다.`,
                },
                { role: "user", content: `Translate these articles to Korean:\n\n${articleList}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "translate_articles",
                  description: "Translate articles to Korean",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number" },
                            translated_title: { type: "string" },
                            translated_summary: { type: "string" },
                          },
                          required: ["index", "translated_title", "translated_summary"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "translate_articles" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.translated_title) continue;
            await supabase.from("news_articles").update({
              title: r.translated_title,
              summary: r.translated_summary || article.summary,
            }).eq("id", article.id);
            translated++;
          }
        } catch (err) { console.error("Translation batch error:", err); }
        if (i + tBatchSize < needsTranslation.length) await new Promise(r => setTimeout(r, 2000));
      }
      return new Response(
        JSON.stringify({ success: true, translated, total: needsTranslation.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Backfill mode: re-summarize domestic articles ---
    if (body.backfillSummaries) {
      const { data: articles } = await supabase
        .from("news_articles")
        .select("id, title, summary, region, country, source, url, date, api_keywords")
        .eq("region", "국내")
        .order("created_at", { ascending: false })
        .limit(200);

      const needsSummary = (articles || []).filter((a: any) => {
        if (!a.summary) return false;
        if (a.summary.length > 150) return true;
        if (/이다\.|했다\.|된다\.|보인다\.|한다\.|있다\.|없다\.|됐다\.|났다\.|왔다\.|겠다\.|진다\./.test(a.summary)) return true;
        return false;
      });
      console.log(`Found ${needsSummary.length} domestic articles needing summary`);

      let updated = 0;
      const batchSize = 20;
      for (let i = 0; i < needsSummary.length; i += batchSize) {
        const batch = needsSummary.slice(i, i + batchSize);
        const articleList = batch.map((a: any, idx: number) => `[${idx}] ${a.title} | ${a.summary.slice(0, 200)}`).join("\n");
        try {
          const aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${GOOGLE_GEMINI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content: `제약/바이오 뉴스 요약 전문가입니다. 각 기사의 핵심 내용을 한국어 2문장 이내로 간결하게 요약하세요. 존댓말(~입니다, ~됩니다, ~했습니다)을 사용하세요.`,
                },
                { role: "user", content: `Summarize these articles:\n\n${articleList}` },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "summarize_articles",
                  description: "Return summaries",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index: { type: "number" },
                            summary: { type: "string" },
                          },
                          required: ["index", "summary"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["results"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "summarize_articles" } },
            }),
          });
          if (!aiResp.ok) { console.error(`Gemini error: ${aiResp.status}`); continue; }
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (!toolCall) continue;
          const parsed = JSON.parse(toolCall.function.arguments);
          for (const r of parsed.results || []) {
            const article = batch[r.index];
            if (!article || !r.summary) continue;
            await supabase.from("news_articles").update({ summary: r.summary }).eq("id", article.id);
            updated++;
          }
        } catch (err) { console.error("Backfill batch error:", err); }
        if (i + batchSize < needsSummary.length) await new Promise(r => setTimeout(r, 2000));
      }
      return new Response(
        JSON.stringify({ success: true, summarized: updated, total: needsSummary.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================
    // MAIN CRAWL FLOW
    // =====================================================

    // 1. Fetch all sources in parallel
    const rssPromises = RSS_SOURCES.map((s) =>
      fetchRss(s).then((articles) => articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country })))
    );
    const htmlPromises = HTML_SOURCES.map((s) =>
      fetchHtml(s).then((articles) => articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country })))
    );
    const firecrawlPromises = FIRECRAWL_SOURCES.map((s) =>
      fetchWithFirecrawl(s).then((articles) => articles.map((a) => ({ ...a, source: s.name, region: s.region, country: s.country })))
    );

    const allFetched = (await Promise.all([...rssPromises, ...htmlPromises, ...firecrawlPromises])).flat();
    console.log(`Total fetched articles: ${allFetched.length}`);

    // 2a. Pre-filter: remove articles whose URL already exists in DB (BEFORE translation)
    // This prevents the same foreign article from being re-translated with slightly different wording each crawl
    const { data: existingInDb } = await supabase.from("news_articles").select("url");
    const existingUrlSet = new Set((existingInDb || []).map((e: any) => e.url));
    const newFetched = allFetched.filter(a => !existingUrlSet.has(a.url));
    console.log(`Pre-filtered to ${newFetched.length} new articles (${allFetched.length - newFetched.length} already in DB)`);

    // 2b. Enrich ALL foreign articles with full body text via Firecrawl
    await enrichForeignArticles(newFetched);

    // 3. Extract keywords + translate foreign articles using Gemini
    const batchSize = 25;
    const allResults: any[] = [];
    for (let i = 0; i < newFetched.length; i += batchSize) {
      const batch = newFetched.slice(i, i + batchSize);
      const results = await extractKeywordsAndTranslate(batch, GOOGLE_GEMINI_API_KEY);

      // Fallback: collect articles the AI missed for a second translation pass
      const returnedUrls = new Set(results.map((r: any) => r.url));
      const missedArticles: typeof batch = [];
      for (const article of batch) {
        if (!returnedUrls.has(article.url)) {
          missedArticles.push(article);
        }
      }
      allResults.push(...results);

      // Second pass: translate missed foreign articles individually
      if (missedArticles.length > 0) {
        console.log(`AI missed ${missedArticles.length} articles, attempting second translation pass`);
        const retryResults = await extractKeywordsAndTranslate(missedArticles, GOOGLE_GEMINI_API_KEY);
        const retryUrls = new Set(retryResults.map((r: any) => r.url));
        allResults.push(...retryResults);
        
        // For any still-missed articles: only insert Korean ones as-is, skip foreign
        for (const article of missedArticles) {
          if (retryUrls.has(article.url)) continue;
          if (article.region === "해외") {
            console.log(`Skipping untranslated foreign article: ${article.title.slice(0, 50)}`);
            continue; // Do NOT insert untranslated foreign articles
          }
          const langMap: Record<string, string> = { JP: "ja", CN: "zh", IN: "en", US: "en", EU: "en" };
          allResults.push({
            title: article.title,
            summary: article.summary || "",
            source: article.source,
            region: article.region,
            country: article.country,
            url: article.url,
            date: article.date,
            api_keywords: [],
            category: "",
            original_language: article.region === "해외" ? (langMap[article.country] || "en") : "ko",
          });
        }
      }

      if (i + batchSize < newFetched.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    // 3. Clean up old articles (older than 7 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffStr = cutoffDate.toISOString().split("T")[0];
    const { count: deletedCount } = await supabase
      .from("news_articles")
      .delete({ count: "exact" })
      .lt("date", cutoffStr);
    if (deletedCount && deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} articles older than 7 days`);
    }

    // 4. Filter by recency: domestic=last 3 days, foreign=yesterday+ (KST)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const kstYesterday = new Date(kstNow);
    kstYesterday.setDate(kstYesterday.getDate() - 1);
    const yesterdayStr = kstYesterday.toISOString().split("T")[0];

    const recentResults = allResults.filter((r) => {
      return r.date >= threeDaysAgoStr;
    });
    console.log(`Filtered to ${recentResults.length} recent articles (${allResults.length - recentResults.length} old articles skipped)`);

    // 5. Insert new articles (skip duplicates using fuzzy matching)
    if (recentResults.length > 0) {
      const { data: existing } = await supabase.from("news_articles").select("title, url, source");

      const existingUrls = new Set((existing || []).map((e: any) => e.url));

      // --- Fuzzy dedup functions (same as frontend deduplicateNews.ts) ---
      const normTitle = (title: string): string =>
        title.replace(/[\s\-–—·:;,.'"""''「」『』【】\[\]()（）]/g, "")
          .replace(/^(속보|단독|종합|업데이트|긴급)/g, "")
          .toLowerCase();

      const extractCoreWords = (title: string): string[] => {
        const matches = title.match(/[가-힣]{2,}/g) || [];
        const stopwords = new Set(["에서", "에게", "으로", "부터", "까지", "에는", "에도", "이다", "이며", "하는", "하고", "한다", "위한", "대한", "관련", "통해", "따른", "있는", "없는", "해당"]);
        return matches.filter(w => !stopwords.has(w));
      };

      const hasConsecutiveOverlap = (wordsA: string[], wordsB: string[], minLen = 3): boolean => {
        if (wordsA.length < minLen || wordsB.length < minLen) return false;
        for (let i = 0; i <= wordsA.length - minLen; i++) {
          const seq = wordsA.slice(i, i + minLen);
          for (let j = 0; j <= wordsB.length - minLen; j++) {
            if (seq.every((w, k) => w === wordsB[j + k])) return true;
          }
        }
        return false;
      };

      const areSimilar = (a: string, b: string): boolean => {
        const normA = normTitle(a);
        const normB = normTitle(b);
        if (normA === normB) return true;
        // One contains the other (>60% length)
        const shorter = normA.length < normB.length ? normA : normB;
        const longer = normA.length < normB.length ? normB : normA;
        if (longer.includes(shorter) && shorter.length / longer.length > 0.6) return true;
        // For non-Korean titles, also do simple normalized comparison
        const normSimple = (t: string) => t.replace(/[^a-zA-Z0-9\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF가-힣]/g, "").toLowerCase();
        const sA = normSimple(a);
        const sB = normSimple(b);
        if (sA.length > 10 && sB.length > 10 && sA === sB) return true;
        if (sA.length > 20 && sB.length > 20) {
          const sh = sA.length < sB.length ? sA : sB;
          const lo = sA.length < sB.length ? sB : sA;
          if (lo.includes(sh) && sh.length / lo.length > 0.6) return true;
        }
        // Core word overlap (Korean)
        const wordsA = extractCoreWords(a);
        const wordsB = extractCoreWords(b);
        if (hasConsecutiveOverlap(wordsA, wordsB, 3)) return true;
        if (wordsA.length < 2 || wordsB.length < 2) return false;
        const setB = new Set(wordsB);
        const overlap = wordsA.filter(w => setB.has(w)).length;
        const maxLen = Math.max(wordsA.length, wordsB.length);
        return overlap / maxLen >= 0.7;
      };

      const existingTitles = (existing || []).map((e: any) => e.title as string);

      // Check against existing DB articles
      const newResults = recentResults.filter((r) => {
        if (existingUrls.has(r.url)) return false;
        // Fuzzy match against all existing titles
        for (const et of existingTitles) {
          if (areSimilar(r.title, et)) return false;
        }
        return true;
      });

      // Deduplicate within batch
      const dedupedResults: any[] = [];
      for (const r of newResults) {
        if (dedupedResults.some(d => d.url === r.url)) continue;
        if (dedupedResults.some(d => areSimilar(d.title, r.title))) continue;
        dedupedResults.push(r);
      }

      if (dedupedResults.length > 0) {
        // Insert one by one to skip DB-level duplicates (unique index on title+source)
        let insertedCount = 0;
        for (const article of dedupedResults) {
          const { error } = await supabase.from("news_articles").insert(article);
          if (error) {
            if (error.code === "23505") {
              console.log(`Skipped DB duplicate: ${article.title}`);
              continue;
            }
            console.error("DB insert error:", error);
          } else {
            insertedCount++;
          }
        }
        console.log(`DB inserted ${insertedCount}/${dedupedResults.length}`);
      }
      console.log(`Inserted ${dedupedResults.length} new articles (${recentResults.length - dedupedResults.length} duplicates skipped)`);
    }

    return new Response(
      JSON.stringify({ success: true, fetched: allFetched.length, withKeywords: allResults.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("crawl-news error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
