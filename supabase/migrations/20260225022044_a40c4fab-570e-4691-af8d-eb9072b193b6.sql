
CREATE TABLE public.biotech_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  payer text NOT NULL,
  payer_country text NOT NULL DEFAULT '',
  payee text NOT NULL,
  payee_country text NOT NULL DEFAULT '',
  total_m numeric NOT NULL DEFAULT 0,
  deal_type text NOT NULL DEFAULT 'Licensing',
  technology text NOT NULL DEFAULT '',
  indication text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.biotech_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read biotech deals" ON public.biotech_deals FOR SELECT USING (true);
CREATE POLICY "Only service role can insert biotech deals" ON public.biotech_deals FOR INSERT WITH CHECK ((SELECT (current_setting('request.jwt.claims'::text, true)::json ->> 'role') = 'service_role'));
CREATE POLICY "Only service role can update biotech deals" ON public.biotech_deals FOR UPDATE USING ((SELECT (current_setting('request.jwt.claims'::text, true)::json ->> 'role') = 'service_role'));
CREATE POLICY "Only service role can delete biotech deals" ON public.biotech_deals FOR DELETE USING ((SELECT (current_setting('request.jwt.claims'::text, true)::json ->> 'role') = 'service_role'));

CREATE UNIQUE INDEX idx_biotech_deals_unique ON public.biotech_deals (payer, payee, date);
