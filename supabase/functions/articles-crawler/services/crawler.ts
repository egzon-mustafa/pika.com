/**
 * Main crawler service that orchestrates all providers
 */

import { Article, CrawlerResult, ProviderResult, ScrapingOptions } from "../types/index.ts";
import { DatabaseService } from "./database.ts";
import { AVAILABLE_PROVIDERS, ProviderName } from "../providers/index.ts";

export class CrawlerService {
  private databaseService: DatabaseService;
  private options: ScrapingOptions;

  constructor(options: ScrapingOptions = {}) {
    this.databaseService = new DatabaseService();
    this.options = {
      maxPages: 3,
      respectRobotsTxt: true,
      requestDelay: 1000,
      maxRetries: 3,
      ...options,
    };
  }

  /**
   * Run the crawler with all available providers
   */
  async crawlAll(): Promise<CrawlerResult> {
    const providerNames = Object.keys(AVAILABLE_PROVIDERS) as ProviderName[];
    return this.crawlProviders(providerNames);
  }

  /**
   * Run the crawler with specific providers
   */
  async crawlProviders(providerNames: ProviderName[]): Promise<CrawlerResult> {
    console.log(`🚀 Starting crawler with providers: ${providerNames.join(", ")}`);
    
    const startTime = Date.now();
    const results: ProviderResult[] = [];
    const allErrors: string[] = [];
    let totalArticlesFetched = 0;
    const providersWithArticles = new Set<string>();

    // Load existing articles once at the beginning
    console.log("📊 Loading existing articles from database...");
    const existingArticles = await this.databaseService.loadExistingArticleUrls();

    // Process each provider
    for (const providerName of providerNames) {
      const result = await this.crawlProvider(providerName, existingArticles);
      results.push(result);
      
      if (result.success && result.articlesFetched > 0) {
        totalArticlesFetched += result.articlesFetched;
        providersWithArticles.add(result.providerName);
      }
      
      allErrors.push(...result.errors);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Log summary
    console.log(`\n📊 Crawler Summary:`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Total articles fetched: ${totalArticlesFetched}`);
    console.log(`   Providers with new articles: ${Array.from(providersWithArticles).join(", ") || "None"}`);
    
    if (allErrors.length > 0) {
      console.log(`   Errors encountered: ${allErrors.length}`);
    }

    // Get database statistics
    const stats = await this.databaseService.getStatistics();
    console.log(`   Total articles in database: ${stats.totalArticles}`);

    return {
      totalArticlesFetched,
      providers: Array.from(providersWithArticles),
      errors: allErrors.length > 0 ? allErrors : undefined,
    };
  }

  /**
   * Crawl a specific provider
   */
  private async crawlProvider(
    providerName: ProviderName,
    existingArticles: Set<string>
  ): Promise<ProviderResult> {
    const ProviderClass = AVAILABLE_PROVIDERS[providerName];
    const provider = new ProviderClass(this.options);
    const errors: string[] = [];

    console.log(`\n🔍 Starting ${providerName} provider...`);

    try {
      // Scrape articles from the provider
      const scrapedArticles = await provider.scrapeArticles();
      console.log(`📰 ${providerName}: Found ${scrapedArticles.length} articles`);

      // Filter out existing articles
      const newArticles = scrapedArticles.filter(article => 
        !existingArticles.has(article.url)
      );

      console.log(`✨ ${providerName}: ${newArticles.length} new articles to save`);

      if (newArticles.length === 0) {
        return {
          providerName,
          articlesFetched: 0,
          errors,
          success: true,
        };
      }

      // Save new articles to database
      const savedCount = await this.databaseService.saveArticles(newArticles);

      // Update existing articles set for subsequent providers
      for (const article of newArticles) {
        existingArticles.add(article.url);
      }

      console.log(`✅ ${providerName}: Successfully saved ${savedCount}/${newArticles.length} articles`);

      return {
        providerName,
        articlesFetched: savedCount,
        errors,
        success: true,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${providerName}: Failed to crawl`, error);
      
      errors.push(`${providerName}: ${errorMessage}`);
      
      return {
        providerName,
        articlesFetched: 0,
        errors,
        success: false,
      };
    }
  }

  /**
   * Get available provider names
   */
  getAvailableProviders(): ProviderName[] {
    return Object.keys(AVAILABLE_PROVIDERS) as ProviderName[];
  }

  /**
   * Test a specific provider without saving to database
   */
  async testProvider(providerName: ProviderName): Promise<Article[]> {
    console.log(`🧪 Testing ${providerName} provider...`);
    
    const ProviderClass = AVAILABLE_PROVIDERS[providerName];
    const provider = new ProviderClass({
      ...this.options,
      maxPages: 1, // Limit to 1 page for testing
    });

    try {
      const articles = await provider.scrapeArticles();
      console.log(`✅ Test successful: Found ${articles.length} articles`);
      return articles;
    } catch (error) {
      console.error(`❌ Test failed:`, error);
      throw error;
    }
  }
}