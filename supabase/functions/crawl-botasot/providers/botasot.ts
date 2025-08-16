/**
 * BotaSot.info news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions } from "@/types";
import { logger } from "@/utils/logger.ts";

export class BotaSotProvider extends BaseProvider {
  private readonly homeUrl = "https://www.botasot.info/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "botasot",
      baseUrl: "https://www.botasot.info",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    const articles: Article[] = [];

    logger.scraping("BotaSot: Scraping articles", { url: this.homeUrl });

    try {
      const pageArticles = await this.scrapePage(this.homeUrl);
      articles.push(...pageArticles);

      logger.success(`BotaSot: Successfully scraped ${articles.length} articles`);
    } catch (error) {
      logger.error("BotaSot: Error scraping articles", { error });
    }

    return articles;
  }

  private async scrapePage(pageUrl: string): Promise<Article[]> {
    const articles: Article[] = [];

    try {
      const response = await this.fetchWithRetry(pageUrl);
      const html = await response.text();
      const $ = loadHtmlToCheerio(html);

      // Debug: Log basic page info
      logger.debug("BotaSot: Page loaded and parsed", { 
        htmlLength: html.length, 
        pageTitle: $('title').text().trim()
      });

      // Use a placeholder date since we don't have explicit dates in the provided HTML
      const defaultDate = "Sot"; // "Today" in Albanian

      // Step 1: Extract the big main article
      const bigArticleLink = $('.big-article.artikulli-kryesor a').first();
      
      if (bigArticleLink.length > 0) {
        logger.debug("BotaSot: Found big article link");
        const article = this.extractArticleData($, bigArticleLink[0], defaultDate, "main");
        if (article && this.validateArticle(article)) {
          articles.push(article);
          logger.success(`BotaSot: Successfully extracted main article: ${article.title.substring(0, 50)}...`);
        }
      } else {
        logger.warn("BotaSot: No big article found with selector '.big-article.artikulli-kryesor a'");
      }

      // Step 2: Extract the small articles from right-view
      const smallArticleLinks = $('.right-view .small-article a').toArray();
      logger.debug(`BotaSot: Found ${smallArticleLinks.length} small article links`);

      for (const [index, articleElement] of smallArticleLinks.entries()) {
        try {
          logger.debug(`BotaSot: Processing small article ${index + 1}/${smallArticleLinks.length}`);
          const article = this.extractArticleData($, articleElement, defaultDate, "small");
          if (article && this.validateArticle(article)) {
            articles.push(article);
            logger.success(`BotaSot: Successfully extracted small article: ${article.title.substring(0, 50)}...`);
          }
        } catch (error) {
          logger.warn(`BotaSot: Error extracting small article ${index + 1}`, { error });
        }
      }

      logger.info(`BotaSot: Total articles extracted: ${articles.length} (1 main + ${smallArticleLinks.length} small expected)`);

    } catch (error) {
      logger.error(`BotaSot: Failed to scrape page ${pageUrl}`, { error });
      throw error;
    }

    return articles;
  }

  private extractArticleData($: any, element: any, defaultDate: string, articleType: "main" | "small"): Article | null {
    try {
      const el = $(element);
      
      // Extract article URL from href attribute
      const articleUrl = el.attr("href")?.trim();
      
      // Extract title based on article type
      let title: string = "";
      
      if (articleType === "main") {
        // For main article: .title-part h1
        title = el.find(".title-part h1").text().trim();
      } else {
        // For small articles: .title-part h2
        title = el.find(".title-part h2").text().trim();
      }
      
      // Extract image URL from img tag within the link
      const imageEl = el.find("img");
      let imageUrl: string | null = null;
      
      if (imageEl.length > 0) {
        // Try src first, then data-src (for lazy loading)
        imageUrl = imageEl.attr("src")?.trim() || imageEl.attr("data-src")?.trim() || null;
      }

      // Log extracted data for debugging
      logger.debug(`BotaSot: Extracted ${articleType} article`, {
        url: articleUrl,
        title: title?.substring(0, 50) + "...",
        hasImage: !!imageUrl,
        titlePartExists: el.find(".title-part").length > 0,
        h1Count: el.find("h1").length,
        h2Count: el.find("h2").length
      });

      // Validate required fields
      if (!articleUrl || !title) {
        logger.warn(`BotaSot: Missing required data for ${articleType} article`, {
          hasUrl: !!articleUrl,
          hasTitle: !!title,
          url: articleUrl,
          titleFound: title
        });
        return null;
      }

      return {
        title: title,
        url: this.ensureAbsoluteUrl(articleUrl),
        imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
        publicationDate: defaultDate,
        publicationSource: this.config.name,
      };
    } catch (error) {
      logger.error("BotaSot: Error extracting article data", { error });
      return null;
    }
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
}