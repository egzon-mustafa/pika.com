/**
 * Telegrafi.com news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions } from "@/types";
import { logger } from "@/utils/logger.ts";

export class TelegrafiProvider extends BaseProvider {
  private readonly trendUrl = "https://telegrafi.com/ne-trend/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "telegrafi",
      baseUrl: "https://telegrafi.com",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    logger.scraping(`Telegrafi: Scraping first page only: ${this.trendUrl}`);

    try {
      const articles = await this.scrapePage(this.trendUrl);
      logger.success(`Telegrafi: Successfully scraped ${articles.length} articles`);
      return articles;
    } catch (error) {
      logger.error(`Telegrafi: Error scraping page ${this.trendUrl}`, { error });
      return [];
    }
  }

  private async scrapePage(pageUrl: string): Promise<Article[]> {
    const articles: Article[] = [];

    try {
      const response = await this.fetchWithRetry(pageUrl);
      const html = await response.text();
      const $ = loadHtmlToCheerio(html);

      // Find all article elements
      const articleElements = $("a.post__large--row").toArray();

      for (const element of articleElements) {
        try {
          const article = this.extractArticleData($, element);
          if (article && this.validateArticle(article)) {
            articles.push(article);
          }
        } catch (error) {
          logger.warn("Telegrafi: Error extracting article data", { error });
        }
      }
    } catch (error) {
      logger.error(`Telegrafi: Failed to scrape page ${pageUrl}`, { error });
      throw error;
    }

    return articles;
  }

  private extractArticleData($: any, element: any): Article | null {
    const el = $(element);
    
    // Extract basic information
    const articleUrl = el.attr("href")?.trim();
    const title = el.find("img").attr("alt")?.trim();
    const imageUrl = el.find("img").attr("src")?.trim() || null;
    const publicationDate = el.find(".post_date_info").text().trim();

    // Validate required fields
    if (!articleUrl || !title || !publicationDate) {
      return null;
    }

    // Ensure URL is absolute
    const absoluteUrl = this.ensureAbsoluteUrl(articleUrl);

    return {
      title: title, // Keep the title exactly as-is
      url: absoluteUrl,
      imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
      publicationDate: this.normalizeDate(publicationDate),
      publicationSource: this.config.name,
    };
  }

  private ensureAbsoluteUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    
    if (url.startsWith("/")) {
      return `${this.config.baseUrl}${url}`;
    }
    
    return `${this.config.baseUrl}/${url}`;
  }



  private normalizeDate(dateString: string): string {
    // Just return the date string as-is without trying to parse it
    // This preserves the original format from the website (e.g., "1 javë", "2 ditë")
    return dateString.trim();
  }
}