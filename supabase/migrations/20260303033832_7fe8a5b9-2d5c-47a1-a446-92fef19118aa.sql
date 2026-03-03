
-- Table to store daily intelligence summaries
CREATE TABLE public.intelligence_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  summary_date date NOT NULL,
  section text NOT NULL, -- 'weekly_issues', 'monthly_issues', 'api_market'
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(summary_date, section)
);

ALTER TABLE public.intelligence_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read intelligence summaries"
ON public.intelligence_summaries FOR SELECT USING (true);

CREATE POLICY "Only service role can insert intelligence summaries"
ON public.intelligence_summaries FOR INSERT
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Only service role can update intelligence summaries"
ON public.intelligence_summaries FOR UPDATE
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Only service role can delete intelligence summaries"
ON public.intelligence_summaries FOR DELETE
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
