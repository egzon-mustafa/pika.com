/**
 * Crawl Gazeta Express - Dedicated Gazeta Express News Crawler
 * 
 * This function crawls specifically GazetaExpress.com and saves articles to Supabase.
 * Uses the same logic as the main articles-crawler but focused on a single provider.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { CrawlerResult, ScrapingOptions, Provider } from "@/types";
import { DatabaseService } from "@/services/database.ts";
import { GazetaExpressProvider } from "@/providers/gazeta-express.ts";
import { logger } from "@/utils/logger.ts";

/**
 * Main crawler function for Gazeta Express
 */
async function crawlGazetaExpress(options?: ScrapingOptions): Promise<CrawlerResult> {
  logger.starting("Gazeta Express crawler starting");
  
  const startTime = Date.now();
  const errors: string[] = [];
  
  try {
    // Initialize services
    const databaseService = new DatabaseService();
    
    // Check if Gazeta Express provider is active
    logger.info("Checking Gazeta Express provider status");
    const isActive = await databaseService.checkProviderStatus(Provider.GAZETA_EXPRESS);
    
    if (!isActive) {
      logger.warn("Gazeta Express provider is not active");
      return {
        totalArticlesFetched: 0,
        provider: Provider.GAZETA_EXPRESS,
        errors: ["Gazeta Express provider is not active"],
      };
    }
    
    logger.info("Gazeta Express provider is active, proceeding with crawling");
    
    const provider = new GazetaExpressProvider(options);
    
    // Load existing articles
    logger.stats("Loading existing articles from database");
    const existingArticles = await databaseService.loadExistingArticleUrls();
    
    // Scrape articles from Gazeta Express
    const scrapedArticles = await provider.scrapeArticles();
    logger.scraping(`Gazeta Express: Found ${scrapedArticles.length} articles`);
    
    // Filter out existing articles
    const newArticles = scrapedArticles.filter(article => 
      !existingArticles.has(article.url)
    );
    
    logger.info(`Gazeta Express: ${newArticles.length} new articles to save`);
    
    let savedCount = 0;
    if (newArticles.length > 0) {
      // Save new articles to database
      savedCount = await databaseService.saveArticles(newArticles);
      logger.success(`Gazeta Express: Successfully saved ${savedCount}/${newArticles.length} articles`);
    } else {
      logger.info("Gazeta Express: No new articles found - all articles already exist in database");
    }
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    // Log summary
    logger.stats("Gazeta Express Crawler Summary");
    logger.stats(`Duration: ${duration}s`);
    logger.stats(`Total articles fetched: ${savedCount}`);
    
    // Get database statistics
    const stats = await databaseService.getStatistics();
    logger.stats(`Total articles in database: ${stats.totalArticles}`);
    
    return {
      totalArticlesFetched: savedCount,
      provider: Provider.GAZETA_EXPRESS,
      errors: errors.length > 0 ? errors : undefined,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Gazeta Express crawler failed", { error });
    errors.push(errorMessage);
    
    return {
      totalArticlesFetched: 0,
      provider: Provider.GAZETA_EXPRESS,
      errors,
    };
  }
}

/**
 * Deno edge function handler
 */
Deno.serve(async (req) => {
  logger.starting(`Crawl Gazeta Express starting at ${new Date().toISOString()}`);
  
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

    const result = await crawlGazetaExpress(options);

    // Check if provider was not active
    if (result.errors && result.errors.includes("Gazeta Express provider is not active")) {
      logger.warn("Gazeta Express provider is not active, returning user message");
      
      return new Response(JSON.stringify({
        message: "Gazeta Express provider is not active",
        provider: Provider.GAZETA_EXPRESS,
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
        message: "You're all up to date! No new articles found from Gazeta Express",
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

    logger.success("Gazeta Express crawler completed successfully");
    
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
    logger.error("Gazeta Express crawler failed", { error });
    
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
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-express' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * With options:
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-express?maxPages=5&requestDelay=500' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * Query Parameters:
 * - maxPages: Number of pages to scrape (default: 3)
 * - requestDelay: Delay between requests in milliseconds (default: 1000)
 */