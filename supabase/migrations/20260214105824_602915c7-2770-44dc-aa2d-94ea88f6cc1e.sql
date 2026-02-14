
-- Restrict insert/update to service role only
DROP POLICY "Service role can insert news" ON public.news_articles;
DROP POLICY "Service role can update news" ON public.news_articles;
DROP POLICY "Service role can insert notices" ON public.regulatory_notices;
DROP POLICY "Service role can update notices" ON public.regulatory_notices;

CREATE POLICY "Only service role can insert news" ON public.news_articles FOR INSERT 
  WITH CHECK ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
CREATE POLICY "Only service role can update news" ON public.news_articles FOR UPDATE 
  USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
CREATE POLICY "Only service role can insert notices" ON public.regulatory_notices FOR INSERT 
  WITH CHECK ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
CREATE POLICY "Only service role can update notices" ON public.regulatory_notices FOR UPDATE 
  USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');
