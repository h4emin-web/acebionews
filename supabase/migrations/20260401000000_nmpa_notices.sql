CREATE TABLE IF NOT EXISTS nmpa_notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_ko TEXT,
  summary TEXT,
  url TEXT,
  date DATE,
  is_suspension_alert BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nmpa_notices_date_idx ON nmpa_notices(date DESC);
ALTER TABLE nmpa_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read nmpa_notices" ON nmpa_notices FOR SELECT USING (true);
CREATE POLICY "Service role write nmpa_notices" ON nmpa_notices FOR ALL
  USING ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role')
  WITH CHECK ((SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role');

SELECT cron.schedule(
  'crawl-nmpa-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wrouiakualcrnkfzhvst.supabase.co/functions/v1/crawl-nmpa',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb3VpYWt1YWxjcm5rZnpodnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjI5NDEsImV4cCI6MjA4NjYzODk0MX0.MVDa_Pf-Y4Q9420VPL1EEFYuZQJH6vu_QLON2xOvnA0'
    ),
    body := '{}'::jsonb
  );
  $$
);
