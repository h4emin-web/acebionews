
-- Create table for IBRIC trend reports
CREATE TABLE public.ibric_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,
  affiliation TEXT,
  description TEXT,
  summary TEXT,
  url TEXT NOT NULL,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ibric_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read ibric reports"
ON public.ibric_reports FOR SELECT USING (true);

CREATE POLICY "Only service role can insert ibric reports"
ON public.ibric_reports FOR INSERT
WITH CHECK ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can update ibric reports"
ON public.ibric_reports FOR UPDATE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can delete ibric reports"
ON public.ibric_reports FOR DELETE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
