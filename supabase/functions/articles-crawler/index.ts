/**
 * Articles Crawler - Modular and Professional Implementation
 * 
 * This function crawls various news sources and saves articles to Supabase.
 * It uses a modular architecture with separate providers for each news source.
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { CrawlerService } from "@/services/crawler.ts";
import { CrawlerResult, ScrapingOptions } from "@/types";
import { logger } from "@/utils/logger.ts";

/**
 * Main handler function for the articles crawler
 */
async function crawlArticles(options?: ScrapingOptions): Promise<CrawlerResult> {
  const crawler = new CrawlerService(options);
  return await crawler.crawlAll();
}

/**
 * Deno edge function handler
 */
Deno.serve(async (req) => {
  logger.starting(`Articles Crawler starting at ${new Date().toISOString()}`);
  
  try {
    // Parse query parameters for options
    const url = new URL(req.url);
    const maxPages = url.searchParams.get("maxPages");
    const requestDelay = url.searchParams.get("requestDelay");
    const providers = url.searchParams.get("providers");

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

    // If specific providers are requested, handle that
    let result: CrawlerResult;
    
    if (providers) {
      const crawler = new CrawlerService(options);
      const providerList = providers.split(",").map(p => p.trim()) as any[];
      const availableProviders = crawler.getAvailableProviders();
      const validProviders = providerList.filter(p => availableProviders.includes(p));
      
      if (validProviders.length === 0) {
        throw new Error(`No valid providers specified. Available: ${availableProviders.join(", ")}`);
      }
      
      result = await crawler.crawlProviders(validProviders);
    } else {
      result = await crawlArticles(options);
    }

    logger.success("Crawler completed successfully");
    
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
    logger.error("Crawler failed", { error });
    
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
 * Basic usage (all providers):
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * With options:
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler?maxPages=5&requestDelay=500' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * Specific providers only:
 * curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler?providers=telegrafi,insajderi' \
 *   --header 'Authorization: Bearer <your_anon_jwt>' \
 *   --header 'Content-Type: application/json'
 *
 * Query Parameters:
 * - maxPages: Number of pages to scrape per provider (default: 3)
 * - requestDelay: Delay between requests in milliseconds (default: 1000)
 * - providers: Comma-separated list of providers to use (default: all)
 *
 * Available Providers: telegrafi, insajderi, gazeta-express, gazeta-blic
 */
