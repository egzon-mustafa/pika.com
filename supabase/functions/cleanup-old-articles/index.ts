/**
 * Cleanup Old Articles Function
 * 
 * This function performs two types of cleanup in priority order:
 * 1. Count-based cleanup (FIRST): Maintains a maximum number of articles (configurable via MAX_ARTICLES env var, defaults to 100)
 *    by removing the oldest articles based on created_at timestamp when the limit is exceeded.
 * 2. Date-based cleanup (SECOND): Removes articles older than X days (configurable via CLEANUP_DAYS_OLD env var, defaults to 5)
 * 
 * Both cleanups run in sequence to ensure optimal database performance and storage management.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { logger } from "@/crawler/utils/logger.ts";

interface CleanupResult {
  deletedCount: number;
  cutoffDate: string;
  countBasedDeletion: {
    deletedCount: number;
    totalArticles: number;
    maxArticles: number;
  };
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Helper function to cleanup articles when count exceeds maximum limit
 * Removes oldest articles based on created_at to stay within the limit
 */
async function cleanupByCount(supabase: any, maxArticles: number) {
  logger.starting(`Cleanup: Checking article count against limit of ${maxArticles}`);

  // Get total count of articles
  const { count: totalCount, error: countError } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    throw new Error(`Failed to count total articles: ${countError.message}`);
  }

  const totalArticles = totalCount || 0;
  logger.stats(`Cleanup: Total articles in database: ${totalArticles}`);

  if (totalArticles <= maxArticles) {
    logger.stats(`Cleanup: Article count (${totalArticles}) is within limit (${maxArticles}). No count-based cleanup needed.`);
    return {
      deletedCount: 0,
      totalArticles,
      maxArticles,
    };
  }

  // Calculate how many articles to delete
  const articlesToDelete = totalArticles - maxArticles;
  logger.stats(`Cleanup: Need to delete ${articlesToDelete} articles to stay within limit`);

  // Get the oldest articles that need to be deleted
  const { data: oldestArticles, error: fetchError } = await supabase
    .from("articles")
    .select("id, created_at")
    .order("created_at", { ascending: true })
    .limit(articlesToDelete);

  if (fetchError) {
    throw new Error(`Failed to fetch oldest articles: ${fetchError.message}`);
  }

  if (!oldestArticles || oldestArticles.length === 0) {
    logger.stats("Cleanup: No articles found to delete");
    return {
      deletedCount: 0,
      totalArticles,
      maxArticles,
    };
  }

  // Extract IDs of articles to delete
  const idsToDelete = oldestArticles.map(article => article.id);
  
  logger.stats(`Cleanup: Deleting ${idsToDelete.length} oldest articles`);

  // Delete the oldest articles
  const { error: deleteError } = await supabase
    .from("articles")
    .delete()
    .in("id", idsToDelete);

  if (deleteError) {
    throw new Error(`Failed to delete oldest articles: ${deleteError.message}`);
  }

  logger.success(`Cleanup: Successfully deleted ${idsToDelete.length} oldest articles`);

  return {
    deletedCount: idsToDelete.length,
    totalArticles,
    maxArticles,
  };
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

  // Get max articles from environment variable (default to 100)
  const maxArticlesEnv = Deno.env.get("MAX_ARTICLES");
  const maxArticles = maxArticlesEnv ? parseInt(maxArticlesEnv, 10) : 100;
  logger.stats(`Cleanup: Max articles allowed: ${maxArticles}`);
  
  // Validate the max articles value
  if (isNaN(maxArticles) || maxArticles < 1) {
    throw new Error(`Invalid MAX_ARTICLES value: ${maxArticlesEnv}. Must be a positive integer.`);
  }

  // Create Supabase client with service role key for admin access
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Calculate the cutoff date (X days ago based on environment variable)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);
  const cutoffISOString = cutoffDate.toISOString();

  logger.starting(`Cleanup: Starting cleanup process`);

  try {
    // PHASE 1: Count-based cleanup (maintain max article count)
    // First, ensure we don't have more than MAX_ARTICLES
    const countBasedResult = await cleanupByCount(supabase, maxArticles);

    // PHASE 2: Date-based cleanup (remove articles older than X days)
    logger.starting(`Cleanup: Starting cleanup of articles older than ${cleanupDays} days (${cutoffISOString})`);
    
    // Count how many articles will be deleted by date
    const { count, error: countError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .lt("created_at", cutoffISOString);

    if (countError) {
      throw new Error(`Failed to count old articles: ${countError.message}`);
    }

    const articlesToDeleteByDate = count || 0;
    logger.stats(`Cleanup: Found ${articlesToDeleteByDate} articles older than ${cleanupDays} days`);

    let dateBasedDeletions = 0;
    if (articlesToDeleteByDate > 0) {
      // Delete the old articles
      const { error: deleteError } = await supabase
        .from("articles")
        .delete()
        .lt("created_at", cutoffISOString);

      if (deleteError) {
        throw new Error(`Failed to delete old articles: ${deleteError.message}`);
      }

      dateBasedDeletions = articlesToDeleteByDate;
      logger.success(`Cleanup: Successfully deleted ${dateBasedDeletions} old articles`);
    } else {
      logger.stats("Cleanup: No articles found older than the specified days");
    }

    const totalDeletions = dateBasedDeletions + countBasedResult.deletedCount;
    let message = "";

    if (countBasedResult.deletedCount > 0 && dateBasedDeletions > 0) {
      message = `Successfully deleted ${countBasedResult.deletedCount} articles to maintain max limit of ${maxArticles}, then deleted ${dateBasedDeletions} additional articles older than ${cleanupDays} days`;
    } else if (countBasedResult.deletedCount > 0) {
      message = `Successfully deleted ${countBasedResult.deletedCount} articles to maintain max limit of ${maxArticles}`;
    } else if (dateBasedDeletions > 0) {
      message = `Successfully deleted ${dateBasedDeletions} articles older than ${cleanupDays} days`;
    } else {
      message = `No articles needed to be deleted. Found ${countBasedResult.totalArticles} articles (limit: ${maxArticles})`;
    }

    return {
      deletedCount: dateBasedDeletions,
      cutoffDate: cutoffISOString,
      countBasedDeletion: countBasedResult,
      success: true,
      message,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    logger.error("Cleanup: Cleanup failed", { error });
    
    return {
      deletedCount: 0,
      cutoffDate: cutoffISOString,
      countBasedDeletion: {
        deletedCount: 0,
        totalArticles: 0,
        maxArticles,
      },
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
 * - PHASE 1: Count-based cleanup (priority)
 *   - Read MAX_ARTICLES environment variable (defaults to 100)
 *   - Count total articles in database
 *   - If count exceeds limit, delete oldest articles to maintain the limit
 * - PHASE 2: Date-based cleanup
 *   - Read CLEANUP_DAYS_OLD environment variable (defaults to 5 days)
 *   - Calculate a cutoff date (X days ago from current time)
 *   - Count and delete articles older than the cutoff date
 * - Return a summary of both cleanup operations
 *
 * Environment Variables:
 * - CLEANUP_DAYS_OLD: Number of days to keep articles (default: 5)
 * - MAX_ARTICLES: Maximum number of articles to maintain (default: 100)
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin access
 *
 * Response format:
 * {
 *   "deletedCount": 25,
 *   "cutoffDate": "2024-01-10T10:30:00.000Z",
 *   "countBasedDeletion": {
 *     "deletedCount": 40,
 *     "totalArticles": 140,
 *     "maxArticles": 100
 *   },
 *   "success": true,
 *   "message": "Successfully deleted 40 articles to maintain max limit of 100, then deleted 25 additional articles older than 5 days",
 *   "timestamp": "2024-01-15T10:30:00.000Z"
 * }
 *
 * Examples:
 * - Set CLEANUP_DAYS_OLD=3 to delete articles older than 3 days
 * - Set MAX_ARTICLES=150 to maintain a maximum of 150 articles
 */