/**
 * Crawl Insajderi - Dedicated Insajderi News Crawler
 * 
 * This function crawls specifically Insajderi.org and saves articles to Supabase.
 * Uses the same logic as the main articles-crawler but focused on a single provider.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { CrawlerResult, ScrapingOptions, Provider } from "@/types";
import { DatabaseService } from "@/services/database.ts";
import { InsajderiProvider } from "@/providers/insajderi.ts";
import { logger } from "@/utils/logger.ts";

/**
 * Main crawler function for Insajderi
 */
async function crawlInsajderi(options?: ScrapingOptions): Promise<CrawlerResult> {
  logger.starting("Insajderi crawler starting");
  
  const startTime = Date.now();
  const errors: string[] = [];
  
  try {
    // Initialize services
    const databaseService = new DatabaseService();
    
    // Check if Insajderi provider is active
    logger.info("Checking Insajderi provider status");
    const isActive = await databaseService.checkProviderStatus(Provider.INSAJDERI);
    
    if (!isActive) {
      logger.warn("Insajderi provider is not active");
      return {
        totalArticlesFetched: 0,
        provider: Provider.INSAJDERI,
        errors: ["Insajderi provider is not active"],
      };
    }
    
    logger.info("Insajderi provider is active, proceeding with crawling");
    
    const provider = new InsajderiProvider(options);
    
    // Load existing articles
    logger.stats("Loading existing articles from database");
    const existingArticles = await databaseService.loadExistingArticleUrls();
    
    // Scrape articles from Insajderi
    const scrapedArticles = await provider.scrapeArticles();
    logger.scraping(`Insajderi: Found ${scrapedArticles.length} articles`);
    
    // Filter out existing articles
    const newArticles = scrapedArticles.filter(article => 
      !existingArticles.has(article.url)
    );
    
    logger.info(`Insajderi: ${newArticles.length} new articles to save`);
    
    let savedCount = 0;
    if (newArticles.length > 0) {
      // Save new articles to database
      savedCount = await databaseService.saveArticles(newArticles);
      logger.success(`Insajderi: Successfully saved ${savedCount}/${newArticles.length} articles`);
    } else {
      logger.info("Insajderi: No new articles found - all articles already exist in database");
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Log summary
    logger.stats("Insajderi Crawler Summary");
    logger.stats(`Duration: ${duration}s`);
    logger.stats(`Total articles fetched: ${savedCount}`);
    
    // Get database statistics
    const stats = await databaseService.getStatistics();
    logger.stats(`Total articles in database: ${stats.totalArticles}`);
    
    return {
      totalArticlesFetched: savedCount,
      provider: Provider.INSAJDERI,
      errors: errors.length > 0 ? errors : undefined,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Insajderi crawler failed", { error });
    errors.push(errorMessage);
    
    return {
      totalArticlesFetched: 0,
      provider: Provider.INSAJDERI,
      errors,
    };
  }
}

/**
 * Deno edge function handler
 */
Deno.serve(async (req) => {
  logger.starting(`Crawl Insajderi starting at ${new Date().toISOString()}`);
  
  try {
    // Parse query parameters for options
    const url = new URL(req.url);
    const maxPages = url.searchParams.get("maxPages");
    const requestDelay = url.searchParams.get("requestDelay");

    // Build scraping options from query parameters
    const options: ScrapingOptions = {};
    
    if (maxPages) {
      const pages = parseInt(maxPages, 10);
      if (!isNaN(pages) && pages > 0) {
        options.maxPages = pages;
      }
    }
    
    if (requestDelay) {
      const delay = parseInt(requestDelay, 10);
      if (!isNaN(delay) && delay >= 0) {
        options.requestDelay = delay;
      }
    }

    const result = await crawlInsajderi(options);

    // Check if provider was not active
    if (result.errors && result.errors.includes("Insajderi provider is not active")) {
      logger.warn("Insajderi provider is not active, returning user message");
      
      return new Response(JSON.stringify({
        message: "Insajderi provider is not active",
        provider: Provider.INSAJDERI,
        active: false,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        status: 200,
      });
    }

    // Check if no new articles were found
    if (result.totalArticlesFetched === 0 && !result.errors) {
      logger.info("No new articles found, returning up-to-date message");
      
      return new Response(JSON.stringify({
        message: "You're all up to date! No new articles found from Insajderi",
        status: "up-to-date",
        timestamp: new Date().toISOString(),
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        status: 200,
      });
    }

    logger.success("Insajderi crawler completed successfully");
    
    return new Response(JSON.stringify(result), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      status: 200,
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Insajderi crawler failed", { error });
    
    return new Response(
      JSON.stringify({ 
        error: JSON.stringify(error),
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
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-insajderi' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * With options:
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-insajderi?maxPages=5&requestDelay=500' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * Query Parameters:
 * - maxPages: Number of pages to scrape (default: 3)
 * - requestDelay: Delay between requests in milliseconds (default: 1000)
 */