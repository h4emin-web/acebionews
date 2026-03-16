-- Update crawl-news schedule from daily to every 30 minutes
SELECT cron.unschedule('daily-crawl-news') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-crawl-news'
);

SELECT cron.schedule(
  'daily-crawl-news',
  '*/30 * * * *',
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
