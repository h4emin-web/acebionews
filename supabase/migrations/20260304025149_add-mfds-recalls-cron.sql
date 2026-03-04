-- Remove existing mfds-recalls schedule if any
SELECT cron.unschedule('crawl-mfds-recalls') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'crawl-mfds-recalls'
);

-- Schedule crawl-mfds-recalls every 3 hours (KST 0시, 3시, 6시, 9시, 12시, 15시, 18시, 21시)
-- UTC 기준: 0, 3, 6, 9, 12, 15, 18, 21시 (KST = UTC+9이므로 표시상 차이 있으나 3시간 간격은 동일)
SELECT cron.schedule(
  'crawl-mfds-recalls',
  '0 */3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wrouiakualcrnkfzhvst.supabase.co/functions/v1/crawl-mfds-recalls',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyb3VpYWt1YWxjcm5rZnpodnN0Iiwicm9sZSI6ImFub20iLCJpYXQiOjE3NzEwNjI5NDEsImV4cCI6MjA4NjYzODk0MX0.MVDa_Pf-Y4Q9420VPL1EEFYuZQJH6vu_QLON2xOvnA0'
    ),
    body := '{}'::jsonb
  );
  $$
);
