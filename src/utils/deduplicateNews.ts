// Normalize title for comparison: remove whitespace, punctuation, common prefixes
function normalizeTitle(title: string): string {
  return title
    .replace(/[\s\-–—·:;,.'"""''「」『』【】\[\]()（）]/g, "")
    .replace(/^(속보|단독|종합|업데이트|긴급)/g, "")
    .toLowerCase();
}

// Extract core nouns (3+ char Korean sequences)
function extractCoreWords(title: string): string[] {
  const matches = title.match(/[가-힣]{2,}/g) || [];
  // Filter out very common words
  const stopwords = new Set(["에서", "에게", "으로", "부터", "까지", "에는", "에도", "이다", "이며", "하는", "하고", "한다", "위한", "대한", "관련", "통해", "따른", "있는", "없는", "해당"]);
  return matches.filter(w => !stopwords.has(w));
}

// Check if two word arrays share 3+ consecutive words
function hasConsecutiveOverlap(wordsA: string[], wordsB: string[], minLen = 3): boolean {
  if (wordsA.length < minLen || wordsB.length < minLen) return false;
  for (let i = 0; i <= wordsA.length - minLen; i++) {
    const seq = wordsA.slice(i, i + minLen);
    for (let j = 0; j <= wordsB.length - minLen; j++) {
      if (seq.every((w, k) => w === wordsB[j + k])) return true;
    }
  }
  return false;
}

// Check if two titles are similar enough to be considered duplicates
function areSimilar(a: string, b: string): boolean {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  
  // Exact normalized match
  if (normA === normB) return true;
  
  // One contains the other (>60% length)
  const shorter = normA.length < normB.length ? normA : normB;
  const longer = normA.length < normB.length ? normB : normA;
  if (longer.includes(shorter) && shorter.length / longer.length > 0.6) return true;

  // Core word overlap
  const wordsA = extractCoreWords(a);
  const wordsB = extractCoreWords(b);

  // 3+ consecutive core words match → duplicate
  if (hasConsecutiveOverlap(wordsA, wordsB, 3)) return true;

  if (wordsA.length < 2 || wordsB.length < 2) return false;
  
  const setB = new Set(wordsB);
  const overlap = wordsA.filter(w => setB.has(w)).length;
  const maxLen = Math.max(wordsA.length, wordsB.length);
  
  return overlap / maxLen >= 0.7;
}

export function deduplicateNews<T extends { title: string; region: string }>(articles: T[]): T[] {
  const result: T[] = [];
  
  for (const article of articles) {
    // Only dedup Korean (국내) articles
    if (article.region !== "국내") {
      result.push(article);
      continue;
    }
    
    const isDuplicate = result.some(
      existing => existing.region === "국내" && areSimilar(existing.title, article.title)
    );
    
    if (!isDuplicate) {
      result.push(article);
    }
  }
  
  return result;
}
