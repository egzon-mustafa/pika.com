-- Setup Cron Job for Cleanup Articles Function
-- 
-- This SQL script sets up cron jobs to automatically call:
-- 1. cleanup-old-articles: Daily at midnight (00:00) 
-- 2. articles-crawler: Every 4 hours
-- Both use Supabase's pg_cron extension.
--
-- PREREQUISITES:
-- 1. Ensure pg_cron and pg_net extensions are enabled
-- 2. Replace placeholders with your actual values
-- 3. Deploy both Edge Functions first:
--    supabase functions deploy cleanup-old-articles
--    supabase functions deploy articles-crawler

-- Step 1: Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Unschedule any existing jobs with the same names (to avoid duplicates)
SELECT cron.unschedule('cleanup-old-articles-daily-midnight');
SELECT cron.unschedule('articles-crawler-every-4h');

-- Step 3: Schedule the cron jobs
-- IMPORTANT: Replace the following placeholders:
-- - YOUR_PROJECT_REF: Your Supabase project reference ID
-- - YOUR_SERVICE_ROLE_KEY: Your Supabase service role key (keep it secure!)

-- 3a. Cleanup job (daily at midnight)
SELECT cron.schedule(
  'cleanup-old-articles-daily-midnight',
  '0 0 * * *', -- Daily at midnight (00:00)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-old-articles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- 3b. Crawler job (every 4 hours)
SELECT cron.schedule(
  'articles-crawler-every-4h',
  '0 */4 * * *', -- Every 4 hours at minute 0
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/articles-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Step 4: Verify the jobs were scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname IN ('cleanup-old-articles-daily-midnight', 'articles-crawler-every-4h')
ORDER BY jobname;

-- MONITORING QUERIES:
-- 
-- View all scheduled jobs:
-- SELECT * FROM cron.job;
--
-- View job execution history:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobname = 'cleanup-old-articles-daily-midnight'
-- ORDER BY start_time DESC 
-- LIMIT 10;
--
-- Unschedule jobs (if needed):
-- SELECT cron.unschedule('cleanup-old-articles-daily-midnight');
-- SELECT cron.unschedule('articles-crawler-every-4h');

-- NOTES:
-- - Cleanup job runs daily at midnight (00:00) for database optimization
-- - Crawler job runs every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00) for fresh content
-- - Make sure both functions are deployed and accessible
-- - The service role key has admin privileges, keep it secure
-- - Check the cron.job_run_details table for execution logs
-- - Adjust the schedule (0 0 * * *) if you want different intervals
--   Examples:
--   - Every minute: * * * * *
--   - Every 10 minutes: */10 * * * *
--   - Every hour: 0 * * * *
--   - Every day at 3 AM: 0 3 * * *