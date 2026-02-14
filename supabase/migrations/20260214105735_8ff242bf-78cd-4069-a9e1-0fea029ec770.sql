
-- News articles table
CREATE TABLE public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('국내', '해외')),
  country TEXT NOT NULL DEFAULT 'KR',
  date DATE NOT NULL,
  url TEXT NOT NULL,
  api_keywords TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT '',
  original_language TEXT DEFAULT 'ko',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Regulatory notices table (MFDS, 의약품안전나라, FDA)
CREATE TABLE public.regulatory_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('MFDS', '의약품안전나라', 'FDA')),
  url TEXT NOT NULL,
  related_apis TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Public read access (news dashboard is public)
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read news" ON public.news_articles FOR SELECT USING (true);
CREATE POLICY "Service role can insert news" ON public.news_articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update news" ON public.news_articles FOR UPDATE USING (true);

ALTER TABLE public.regulatory_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read notices" ON public.regulatory_notices FOR SELECT USING (true);
CREATE POLICY "Service role can insert notices" ON public.regulatory_notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update notices" ON public.regulatory_notices FOR UPDATE USING (true);

-- Indexes
CREATE INDEX idx_news_date ON public.news_articles (date DESC);
CREATE INDEX idx_news_keywords ON public.news_articles USING GIN (api_keywords);
CREATE INDEX idx_notices_source ON public.regulatory_notices (source, date DESC);
