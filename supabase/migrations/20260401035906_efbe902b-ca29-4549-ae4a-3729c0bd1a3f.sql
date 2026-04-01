
CREATE TABLE public.nmpa_notices (
  id text PRIMARY KEY,
  title text NOT NULL,
  title_ko text,
  summary text,
  url text,
  date date NOT NULL,
  is_suspension_alert boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.nmpa_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read nmpa notices" ON public.nmpa_notices FOR SELECT TO public USING (true);
CREATE POLICY "Only service role can insert nmpa notices" ON public.nmpa_notices FOR INSERT TO public WITH CHECK ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
CREATE POLICY "Only service role can update nmpa notices" ON public.nmpa_notices FOR UPDATE TO public USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
CREATE POLICY "Only service role can delete nmpa notices" ON public.nmpa_notices FOR DELETE TO public USING ((SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text);
