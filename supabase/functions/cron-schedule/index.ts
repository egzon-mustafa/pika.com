/**
 * Cron Schedule Function
 * 
 * This function sets up and manages scheduled cron jobs using Supabase's pg_cron extension.
 * It schedules the cleanup-old-articles function to run daily at midnight (00:00) to maintain 
 * database optimization and storage management.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "jsr:@supabase/supabase-js@2";

interface CronSetupResult {
  success: boolean;
  message: string;
  jobName: string;
  schedule: string;
  timestamp: string;
}

/**
 * Sets up the cron job to call cleanup-old-articles daily at midnight
 */
async function setupCleanupCronJob(): Promise<CronSetupResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const jobName = "cleanup-old-articles-daily-midnight";
  const cronSchedule = "0 0 * * *"; // Every day at 00:00 (midnight)
  
  try {
    console.log(`Setting up cron job: ${jobName} with schedule: ${cronSchedule}`);

    // Execute SQL directly to schedule the cron job
    // This uses the standard cron.schedule function from pg_cron extension
    const { data, error } = await supabase
      .from('cron.job')
      .select('jobname')
      .eq('jobname', jobName)
      .maybeSingle();

    // If job exists, log it but continue (we'll overwrite it)
    if (data) {
      console.log(`Job ${jobName} already exists, it will be overwritten`);
    }

    // Use Supabase's SQL execution to schedule the cron job
    const { error: scheduleError } = await supabase
      .rpc('cron_schedule', {
        job_name: jobName,
        cron_schedule: cronSchedule,
        sql: `
          SELECT net.http_post(
            url := '${supabaseUrl}/functions/v1/cleanup-old-articles',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ${supabaseServiceKey}'
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 30000
          ) as request_id;
        `
      });

    if (scheduleError) {
      throw new Error(`Failed to schedule cron job: ${scheduleError.message}`);
    }

    console.log(`Successfully scheduled cron job: ${jobName}`);

    return {
      success: true,
      message: `Successfully scheduled cleanup job to run daily at midnight (00:00)`,
      jobName,
      schedule: cronSchedule,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error("Failed to setup cron job:", error);
    
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      jobName,
      schedule: cronSchedule,
      timestamp: new Date().toISOString(),
    };
  }
}

Deno.serve(async (req) => {
  console.log(`Cron Schedule function called at ${new Date().toISOString()}`);
  
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

    const result = await setupCleanupCronJob();

    console.log("Cron setup completed:", result.success ? "successfully" : "with errors");
    
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
    console.error("Cron setup function failed:", error);
    
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
 * This function sets up a cron job to call the cleanup-old-articles function daily at midnight (00:00).
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
 * 2. Deploy both functions:
 *    supabase functions deploy cleanup-old-articles
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
 * You can also set up the cron job manually via SQL Editor:
 * 
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
 * MONITORING:
 * - View scheduled jobs: SELECT * FROM cron.job;
 * - View job history: SELECT * FROM cron.job_run_details ORDER BY start_time DESC;
 * - Unschedule job: SELECT cron.unschedule('cleanup-old-articles-daily-midnight');
 * 
 * ENVIRONMENT VARIABLES REQUIRED:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 * - CLEANUP_DAYS_OLD: Number of days to keep articles (default: 5)
 * - MAX_ARTICLES: Maximum number of articles to maintain (default: 100)
 * 
 * The cleanup function will run daily at midnight and:
 * 1. Remove excess articles if more than MAX_ARTICLES exist (keeping newest)
 * 2. Remove articles older than CLEANUP_DAYS_OLD days
 */
