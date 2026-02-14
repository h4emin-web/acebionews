
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily crawl-news at 00:00 KST (15:00 UTC previous day)
SELECT cron.schedule(
  'daily-crawl-news',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wrouiakualcrnkfzhvst.supabase.co/functions/v1/crawl-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb3VpYWt1YWxjcm5rZnpodnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjI5NDEsImV4cCI6MjA4NjYzODk0MX0.MVDa_Pf-Y4Q9420VPL1EEFYuZQJH6vu_QLON2xOvnA0'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule daily crawl-regulatory at 00:05 KST (15:05 UTC previous day)
SELECT cron.schedule(
  'daily-crawl-regulatory',
  '5 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wrouiakualcrnkfzhvst.supabase.co/functions/v1/crawl-regulatory',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb3VpYWt1YWxjcm5rZnpodnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNjI5NDEsImV4cCI6MjA4NjYzODk0MX0.MVDa_Pf-Y4Q9420VPL1EEFYuZQJH6vu_QLON2xOvnA0'
    ),
    body := '{}'::jsonb
  );
  $$
);
