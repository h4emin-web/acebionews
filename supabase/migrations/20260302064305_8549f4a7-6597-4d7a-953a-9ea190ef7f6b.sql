
CREATE TABLE public.mfds_recalls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name text NOT NULL,
  company text NOT NULL,
  recall_reason text NOT NULL,
  order_date date NOT NULL,
  url text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.mfds_recalls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read mfds recalls"
ON public.mfds_recalls FOR SELECT USING (true);

CREATE POLICY "Only service role can insert mfds recalls"
ON public.mfds_recalls FOR INSERT
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role') = 'service_role');

CREATE POLICY "Only service role can update mfds recalls"
ON public.mfds_recalls FOR UPDATE
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role') = 'service_role');

CREATE POLICY "Only service role can delete mfds recalls"
ON public.mfds_recalls FOR DELETE
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role') = 'service_role');
