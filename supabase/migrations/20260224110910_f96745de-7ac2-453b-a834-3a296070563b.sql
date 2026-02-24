
-- Add unique index on title+source to prevent duplicate articles at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_articles_title_source 
ON news_articles (title, source);
