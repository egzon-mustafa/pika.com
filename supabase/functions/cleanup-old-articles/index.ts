/**
 * Cleanup Old Articles Function
 * 
 * This function deletes all articles older than 7 days based on created_at field.
 * Simple and straightforward cleanup to maintain database performance.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

// Simple logger for cleanup function
const logger = {
  starting: (message: string) => console.log(`🚀 ${message}`),
  success: (message: string) => console.log(`✅ ${message}`),
  error: (message: string, data?: any) => console.error(`❌ ${message}`, data),
  info: (message: string) => console.log(`ℹ️ ${message}`),
  stats: (message: string) => console.log(`📊 ${message}`)
};

interface CleanupResult {
  deletedCount: number;
  cutoffDate: string;
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Main cleanup function - deletes articles older than 7 days
 */
async function cleanupOldArticles(): Promise<CleanupResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate the cutoff date (7 days ago)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoffISOString = cutoffDate.toISOString();

  logger.starting(`Starting cleanup of articles older than 7 days (${cutoffISOString})`);

  try {
    // Count how many articles will be deleted
    const { count, error: countError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffISOString);

    if (countError) {
      throw new Error(`Failed to count old articles: ${countError.message}`);
    }

    const articlesToDelete = count || 0;
    logger.stats(`Found ${articlesToDelete} articles older than 7 days`);

    let deletedCount = 0;
    if (articlesToDelete > 0) {
      // Delete the old articles
      const { error: deleteError } = await supabase
        .from("articles")
        .delete()
        .lt("created_at", cutoffISOString);

      if (deleteError) {
        throw new Error(`Failed to delete old articles: ${deleteError.message}`);
      }

      deletedCount = articlesToDelete;
      logger.success(`Successfully deleted ${deletedCount} articles older than 7 days`);
    } else {
      logger.stats("No articles found older than 7 days");
    }

    const message = deletedCount > 0 
      ? `Successfully deleted ${deletedCount} articles older than 7 days`
      : "No articles needed to be deleted";

    return {
      deletedCount,
      cutoffDate: cutoffISOString,
      success: true,
      message,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error("Cleanup failed", { error });
    
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

    logger.success("Cleanup completed successfully", { 
      deletedCount: result.deletedCount,
      success: result.success 
    });
    
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
 * - Delete all articles older than 7 days based on created_at field
 * - Return a summary of the cleanup operation
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Response format:
 * {
 *   "deletedCount": 25,
 *   "cutoffDate": "2024-01-10T10:30:00.000Z",
 *   "success": true,
 *   "message": "Successfully deleted 25 articles older than 7 days",
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 *
 * The cleanup runs automatically via cron job daily at midnight.
 */