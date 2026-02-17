
ALTER TABLE public.news_articles ADD COLUMN related_keywords text[] NOT NULL DEFAULT '{}'::text[];
