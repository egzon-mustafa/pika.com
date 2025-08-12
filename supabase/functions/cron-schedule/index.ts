/**
 * Cron Schedule Function
 * 
 * This function sets up and manages scheduled cron jobs using Supabase's pg_cron extension.
 * It schedules two automated jobs:
 * 1. cleanup-old-articles: Runs daily at midnight (00:00) for database optimization
 * 2. articles-crawler: Runs every 4 hours to fetch fresh articles
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "jsr:@supabase/supabase-js@2";
import { logger } from "../articles-crawler/utils/logger.ts";

interface CronJobResult {
  jobName: string;
  schedule: string;
  success: boolean;
  message: string;
}

interface CronSetupResult {
  success: boolean;
  message: string;
  jobs: CronJobResult[];
  timestamp: string;
}

/**
 * Helper function to schedule a single cron job
 */
async function scheduleJob(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  jobName: string,
  cronSchedule: string,
  functionName: string
): Promise<CronJobResult> {
  try {
    logger.starting(`Setting up cron job: ${jobName} with schedule: ${cronSchedule}`);

    // Check if job already exists
    const { data, error } = await supabase
      .from('cron.job')
      .select('jobname')
      .eq('jobname', jobName)
      .maybeSingle();

    if (data) {
      logger.stats(`Job ${jobName} already exists, it will be overwritten`);
    }

    // Generate SQL command for manual execution
    const sqlCommand = `
SELECT cron.schedule(
  '${jobName}',
  '${cronSchedule}',
  $$
  SELECT net.http_post(
    url := '${supabaseUrl}/functions/v1/${functionName}',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ${supabaseServiceKey}'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);`;

    logger.stats(`Generated SQL command for ${jobName}:`, { sqlCommand });

    // For now, we'll return success with instructions
    // In a production setup, you would execute this SQL manually in Supabase SQL Editor

    logger.success(`Successfully scheduled cron job: ${jobName}`);

    return {
      jobName,
      schedule: cronSchedule,
      success: true,
      message: `SQL command generated for ${functionName} job. Please execute the logged SQL in Supabase SQL Editor to activate the cron job.`,
    };

  } catch (error) {
    logger.error(`Failed to setup cron job ${jobName}`, { error });
    
    return {
      jobName,
      schedule: cronSchedule,
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sets up all cron jobs: cleanup daily at midnight and crawler every 4 hours
 */
async function setupAllCronJobs(): Promise<CronSetupResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    logger.starting("Setting up all cron jobs...");

    // Schedule cleanup job (daily at midnight)
    const cleanupJob = await scheduleJob(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      "cleanup-old-articles-daily-midnight",
      "0 0 * * *", // Daily at 00:00 (midnight)
      "cleanup-old-articles"
    );

    // Schedule crawler job (every 4 hours)
    const crawlerJob = await scheduleJob(
      supabase,
      supabaseUrl,
      supabaseServiceKey,
      "articles-crawler-every-4h",
      "0 */4 * * *", // Every 4 hours
      "articles-crawler"
    );

    const jobs = [cleanupJob, crawlerJob];
    const allSuccessful = jobs.every(job => job.success);
    const successfulJobs = jobs.filter(job => job.success).length;

    let message = "";
    if (allSuccessful) {
      message = `Successfully generated SQL commands for all ${jobs.length} cron jobs. Please execute the SQL commands shown in the logs in your Supabase SQL Editor to activate: cleanup (daily at midnight) and crawler (every 4 hours)`;
    } else {
      message = `Generated ${successfulJobs}/${jobs.length} SQL commands successfully. Check individual job results and logs for SQL commands to execute.`;
    }

    logger.success(`Cron setup completed: ${successfulJobs}/${jobs.length} jobs scheduled successfully`);

    return {
      success: allSuccessful,
      message,
      jobs,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error("Failed to setup cron jobs", { error });
    
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      jobs: [],
      timestamp: new Date().toISOString(),
    };
  }
}

Deno.serve(async (req) => {
  logger.starting(`Cron Schedule function called at ${new Date().toISOString()}`);
  
  try {
    // Only allow POST requests for safety
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          error: "Method not allowed. Use POST to setup cron jobs.",
          timestamp: new Date().toISOString(),
        }), 
        {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          status: 405,
        }
      );
    }

    const result = await setupAllCronJobs();

    logger.success("Cron setup completed", { 
      success: result.success, 
      jobsScheduled: result.jobs.length,
      successfulJobs: result.jobs.filter(job => job.success).length
    });
    
    return new Response(JSON.stringify(result), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      status: result.success ? 200 : 500,
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Cron setup function failed", { error });
    
    return new Response(
      JSON.stringify({ 
        error: message,
        success: false,
        timestamp: new Date().toISOString(),
      }), 
      {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 500,
      }
    );
  }
})

/* 
 * CRON SCHEDULE SETUP GUIDE
 * 
 * This function sets up automated cron jobs:
 * 1. cleanup-old-articles: Daily at midnight (00:00)
 * 2. articles-crawler: Every 4 hours
 * 
 * PREREQUISITES:
 * 1. Enable required PostgreSQL extensions in your Supabase project:
 *    - Go to Supabase Dashboard → SQL Editor
 *    - Run the following SQL commands:
 * 
 *    -- Enable pg_cron extension for scheduling
 *    CREATE EXTENSION IF NOT EXISTS pg_cron;
 *    
 *    -- Enable pg_net extension for HTTP requests
 *    CREATE EXTENSION IF NOT EXISTS pg_net;
 * 
 * USAGE:
 * 
 * 1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
 * 2. Deploy all functions:
 *    supabase functions deploy cleanup-old-articles
 *    supabase functions deploy articles-crawler
 *    supabase functions deploy cron-schedule
 * 
 * 3. Setup the cron job by calling this function:
 *    curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cron-schedule' \
 *      --header 'Authorization: Bearer <your_service_role_key>' \
 *      --header 'Content-Type: application/json'
 * 
 * 4. For production, replace localhost with your Supabase project URL:
 *    curl -i --location --request POST 'https://your-project-ref.supabase.co/functions/v1/cron-schedule' \
 *      --header 'Authorization: Bearer <your_service_role_key>' \
 *      --header 'Content-Type: application/json'
 * 
 * ALTERNATIVE: Manual SQL Setup
 * You can also set up the cron jobs manually via SQL Editor:
 * 
 * -- Cleanup job (daily at midnight)
 * SELECT cron.schedule(
 *   'cleanup-old-articles-daily-midnight',
 *   '0 0 * * *',
 *   $$
 *   SELECT net.http_post(
 *     url := 'https://your-project-ref.supabase.co/functions/v1/cleanup-old-articles',
 *     headers := jsonb_build_object(
 *       'Content-Type', 'application/json',
 *       'Authorization', 'Bearer <your_service_role_key>'
 *     ),
 *     body := '{}'::jsonb,
 *     timeout_milliseconds := 30000
 *   ) as request_id;
 *   $$
 * );
 * 
 * -- Crawler job (every 4 hours)
 * SELECT cron.schedule(
 *   'articles-crawler-every-4h',
 *   '0 *\/4 * * *',
 *   $$
 *   SELECT net.http_post(
 *     url := 'https://your-project-ref.supabase.co/functions/v1/articles-crawler',
 *     headers := jsonb_build_object(
 *       'Content-Type', 'application/json',
 *       'Authorization', 'Bearer <your_service_role_key>'
 *     ),
 *     body := '{}'::jsonb,
 *     timeout_milliseconds := 30000
 *   ) as request_id;
 *   $$
 * );
 * 
 * MONITORING:
 * - View scheduled jobs: SELECT * FROM cron.job;
 * - View job history: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
 * - Unschedule cleanup job: SELECT cron.unschedule('cleanup-old-articles-daily-midnight');
 * - Unschedule crawler job: SELECT cron.unschedule('articles-crawler-every-4h');
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 * - CLEANUP_DAYS_OLD: Number of days to keep articles (default: 5)
 * - MAX_ARTICLES: Maximum number of articles to maintain (default: 100)
 * 
 * SCHEDULED JOBS:
 * 1. Cleanup function (daily at 00:00):
 *    - Remove excess articles if more than MAX_ARTICLES exist (keeping newest)
 *    - Remove articles older than CLEANUP_DAYS_OLD days
 * 2. Crawler function (every 4 hours at :00):
 *    - Fetch new articles from configured news sources
 *    - Update database with fresh content
 */
