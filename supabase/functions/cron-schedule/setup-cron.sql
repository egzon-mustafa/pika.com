-- Setup Cron Job for Cleanup Articles Function
-- 
-- This SQL script sets up a cron job to automatically call the cleanup-old-articles 
-- Edge Function daily at midnight (00:00) using Supabase's pg_cron extension.
--
-- PREREQUISITES:
-- 1. Ensure pg_cron and pg_net extensions are enabled
-- 2. Replace placeholders with your actual values
-- 3. Deploy the cleanup-old-articles Edge Function first

-- Step 1: Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Unschedule any existing job with the same name (to avoid duplicates)
SELECT cron.unschedule('cleanup-old-articles-daily-midnight');

-- Step 3: Schedule the cron job to run daily at midnight (00:00)
-- IMPORTANT: Replace the following placeholders:
-- - YOUR_PROJECT_REF: Your Supabase project reference ID
-- - YOUR_SERVICE_ROLE_KEY: Your Supabase service role key (keep it secure!)

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

-- Step 4: Verify the job was scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'cleanup-old-articles-daily-midnight';

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
-- Unschedule the job (if needed):
-- SELECT cron.unschedule('cleanup-old-articles-daily-midnight');

-- NOTES:
-- - The cron job will call the cleanup function daily at midnight (00:00)
-- - Make sure your cleanup function is deployed and accessible
-- - The service role key has admin privileges, keep it secure
-- - Check the cron.job_run_details table for execution logs
-- - Adjust the schedule (0 0 * * *) if you want different intervals
--   Examples:
--   - Every minute: * * * * *
--   - Every 10 minutes: */10 * * * *
--   - Every hour: 0 * * * *
--   - Every day at 3 AM: 0 3 * * *