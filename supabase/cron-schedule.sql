-- Schedule cleanup-old-articles to run weekly on Sunday at 00:00 (midnight)
SELECT cron.schedule(
  'cleanup-old-articles-weekly-sunday',
  '0 0 * * 0', -- Weekly on Sunday at 00:00 (midnight)
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/cleanup-old-articles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);


-- Schedule crawl-gazeta-express to run every 4 hours
SELECT cron.schedule(
  'crawl-gazeta-express-every-4-hours',
  '0 */4 * * *', -- Every 4 hours at minute 0
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-gazeta-express',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Schedule crawl-gazeta-blic to run every 4 hours (offset by 1 hour)
SELECT cron.schedule(
  'crawl-gazeta-blic-every-4-hours',
  '0 1,5,9,13,17,21 * * *', -- Every 4 hours starting at 01:00
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-gazeta-blic',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Schedule crawl-telegrafi to run every 4 hours (offset by 2 hours)
SELECT cron.schedule(
  'crawl-telegrafi-every-4-hours',
  '0 2,6,10,14,18,22 * * *', -- Every 4 hours starting at 02:00
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-telegrafi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Schedule crawl-insajderi to run every 4 hours (offset by 3 hours)
SELECT cron.schedule(
  'crawl-insajderi-every-4-hours',
  '0 3,7,11,15,19,23 * * *', -- Every 4 hours starting at 03:00
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-insajderi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Schedule crawl-indeksonline to run every 4 hours (offset by 4 hours)
SELECT cron.schedule(
  'crawl-indeksonline-every-4-hours',
  '0 4,8,12,16,20,0 * * *', -- Every 4 hours starting at 04:00
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-indeksonline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);

-- Schedule crawl-botasot to run every 4 hours (offset by 5 hours)
SELECT cron.schedule(
  'crawl-botasot-every-4-hours',
  '0 5,9,13,17,21,1 * * *', -- Every 4 hours starting at 05:00
  $$
  SELECT net.http_post(
    url := 'https://khjksqvjjbexdefwdetc.supabase.co/functions/v1/crawl-botasot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamtzcXZqamJleGRlZndkZXRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDk0MjEwNSwiZXhwIjoyMDcwNTE4MTA1fQ.Dy_NGneuCMFpQTEC5eqr_PREqa5QSSbIKDDbrznUZ5U'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);