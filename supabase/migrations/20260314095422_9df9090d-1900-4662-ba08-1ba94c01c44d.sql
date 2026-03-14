UPDATE news_articles 
SET summary = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        summary,
        '\$\s*\(\s*function\s*\(\s*\)[\s\S]*', '', 'gi'
      ),
      '#AD\d+\.ad-template\s*\{[^}]*\}[^$]*?(?=\s[가-힣])', '', 'gi'
    ),
    '#AD\w+[\s\S]*?(?=\s[가-힣]|\s*$)', '', 'gi'
  ),
  '\s+', ' ', 'g'
)
WHERE summary LIKE '%$(function%' OR summary LIKE '%#AD%';