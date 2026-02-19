
-- Create substack_posts table for Bio Weekly
CREATE TABLE public.substack_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_label TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  date DATE NOT NULL,
  summary TEXT,
  is_free BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.substack_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read substack posts"
ON public.substack_posts FOR SELECT USING (true);

CREATE POLICY "Only service role can insert substack posts"
ON public.substack_posts FOR INSERT
WITH CHECK ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can update substack posts"
ON public.substack_posts FOR UPDATE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);

CREATE POLICY "Only service role can delete substack posts"
ON public.substack_posts FOR DELETE
USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
