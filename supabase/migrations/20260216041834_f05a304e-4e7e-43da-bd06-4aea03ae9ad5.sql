
-- Create table for pharma industry reports from Naver Securities
CREATE TABLE public.industry_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  broker TEXT NOT NULL,
  date DATE NOT NULL,
  report_url TEXT NOT NULL,
  pdf_url TEXT,
  views INTEGER DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint to prevent duplicates
ALTER TABLE public.industry_reports ADD CONSTRAINT unique_report_url UNIQUE (report_url);

-- Enable RLS
ALTER TABLE public.industry_reports ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read reports" 
ON public.industry_reports FOR SELECT USING (true);

-- Service role insert/update
CREATE POLICY "Only service role can insert reports" 
ON public.industry_reports FOR INSERT 
WITH CHECK ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can update reports" 
ON public.industry_reports FOR UPDATE 
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can delete reports" 
ON public.industry_reports FOR DELETE 
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

-- Index for date-based queries
CREATE INDEX idx_industry_reports_date ON public.industry_reports (date DESC);
