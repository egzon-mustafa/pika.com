/**
 * Cleanup Old Articles Function
 * 
 * This function removes articles that are older than X days (configurable via CLEANUP_DAYS_OLD env var, defaults to 5) 
 * based on their created_at timestamp. It helps keep the database optimized by removing stale content.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { logger } from "../articles-crawler/utils/logger.ts";

interface CleanupResult {
  deletedCount: number;
  cutoffDate: string;
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Main cleanup function
 */
async function cleanupOldArticles(): Promise<CleanupResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Get cleanup days from environment variable (default to 5 days)
  const cleanupDaysEnv = Deno.env.get("CLEANUP_DAYS_OLD");
  const cleanupDays = cleanupDaysEnv ? parseInt(cleanupDaysEnv, 10) : 5;
  logger.stats(`Cleanup: Cleanup days: ${cleanupDays}`);
  
  // Validate the cleanup days value
  if (isNaN(cleanupDays) || cleanupDays < 1) {
    throw new Error(`Invalid CLEANUP_DAYS_OLD value: ${cleanupDaysEnv}. Must be a positive integer.`);
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate the cutoff date (X days ago based on environment variable)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
  const cutoffISOString = cutoffDate.toISOString();

  logger.starting(`Cleanup: Starting cleanup of articles older than ${cleanupDays} days (${cutoffISOString})`);

  try {
    // First, count how many articles will be deleted
    const { count, error: countError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffISOString);

    if (countError) {
      throw new Error(`Failed to count old articles: ${countError.message}`);
    }

    const articlesToDelete = count || 0;
    logger.stats(`Cleanup: Found ${articlesToDelete} articles older than ${cleanupDays} days`);

    if (articlesToDelete === 0) {
      return {
        deletedCount: 0,
        cutoffDate: cutoffISOString,
        success: true,
        message: `No articles found older than ${cleanupDays} days`,
        timestamp: new Date().toISOString(),
      };
    }

    // Delete the old articles
    const { error: deleteError } = await supabase
      .from("articles")
      .delete()
      .lt("created_at", cutoffISOString);

    if (deleteError) {
      throw new Error(`Failed to delete old articles: ${deleteError.message}`);
    }

    logger.success(`Cleanup: Successfully deleted ${articlesToDelete} old articles`);

    return {
      deletedCount: articlesToDelete,
      cutoffDate: cutoffISOString,
      success: true,
      message: `Successfully deleted ${articlesToDelete} articles older than ${cleanupDays} days`,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error("Cleanup: Cleanup failed", { error });
    
    return {
      deletedCount: 0,
      cutoffDate: cutoffISOString,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Deno edge function handler
 */
Deno.serve(async (req) => {
  logger.starting(`Cleanup Old Articles function starting at ${new Date().toISOString()}`);
  
  try {
    // Only allow POST requests for safety
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ 
          error: "Method not allowed. Use POST to trigger cleanup.",
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

    const result = await cleanupOldArticles();

    logger.success("Cleanup completed successfully");
    
    return new Response(JSON.stringify(result), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      status: 200,
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Cleanup function failed", { error });
    
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
});

/* 
 * API Usage:
 * 
 * 1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
 * 2. Make an HTTP request:
 *
 * Basic usage:
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cleanup-old-articles' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * The function will:
 * - Read CLEANUP_DAYS_OLD environment variable (defaults to 5 days)
 * - Calculate a cutoff date (X days ago from current time)
 * - Count articles older than the cutoff date
 * - Delete those articles from the database
 * - Return a summary of the cleanup operation
 *
 * Environment Variables:
 * - CLEANUP_DAYS_OLD: Number of days to keep articles (default: 5)
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Response format:
 * {
 *   "deletedCount": 25,
 *   "cutoffDate": "2024-01-10T10:30:00.000Z",
 *   "success": true,
 *   "message": "Successfully deleted 25 articles older than 5 days",
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 *
 * Example with custom days:
 * Set CLEANUP_DAYS_OLD=3 to delete articles older than 3 days
 */