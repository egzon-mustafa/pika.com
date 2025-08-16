/**
 * IndeksOnline.net news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions } from "@/types";
import { logger } from "@/utils/logger.ts";

export class IndeksOnlineProvider extends BaseProvider {
  private readonly homeUrl = "https://indeksonline.net/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "indeksonline",
      baseUrl: "https://indeksonline.net",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    const articles: Article[] = [];

    logger.scraping("IndeksOnline: Scraping articles", { url: this.homeUrl });

    try {
      const pageArticles = await this.scrapePage(this.homeUrl);
      articles.push(...pageArticles);

      logger.success(`IndeksOnline: Successfully scraped ${articles.length} articles`);
    } catch (error) {
      logger.error("IndeksOnline: Error scraping articles", { error });
    }

    return articles;
  }

  private async scrapePage(pageUrl: string): Promise<Article[]> {
    const articles: Article[] = [];

    try {
      const response = await this.fetchWithRetry(pageUrl);
      const html = await response.text();
      const $ = loadHtmlToCheerio(html);

      // Debug: Log some basic page info
      logger.debug("IndeksOnline: Page loaded and parsed", { 
        htmlLength: html.length, 
        pageTitle: $('title').text().trim(),
        flexsliderMainSlide: $('.flexslider.mainSlide').length
      });

      // Use a placeholder date since we don't have explicit dates in the provided HTML
      const defaultDate = "Sot"; // "Today" in Albanian

      // Find articles in the flexslider
      const slides = $('.flexslider.mainSlide .slides li').toArray();
      logger.debug(`IndeksOnline: Found ${slides.length} slides`);

      for (const slide of slides) {
        const slideEl = $(slide);
        
        // Get all anchor tags in this slide
        const links = slideEl.find('a').toArray();
        logger.debug(`IndeksOnline: Found ${links.length} links in slide`);

        for (const [index, link] of links.entries()) {
          try {
            logger.debug(`IndeksOnline: Processing link ${index + 1}/${links.length}`);
            const article = this.extractArticleData($, link, defaultDate);
            if (article && this.validateArticle(article)) {
              articles.push(article);
              logger.success(`IndeksOnline: Successfully extracted article: ${article.title.substring(0, 50)}...`);
            }
          } catch (error) {
            logger.warn(`IndeksOnline: Error extracting article data from link ${index + 1}`, { error });
          }
        }
      }

    } catch (error) {
      logger.error(`IndeksOnline: Failed to scrape page ${pageUrl}`, { error });
      throw error;
    }

    return articles;
  }

  private extractArticleData($: any, element: any, defaultDate: string): Article | null {
    try {
      const el = $(element);
      
      // Extract article URL from href attribute
      const articleUrl = el.attr("href")?.trim();
      
      // Extract title from title attribute (as mentioned in your instructions)
      let title = el.attr("title")?.trim();
      
      // If title attribute doesn't exist, try to get it from the h2 element
      if (!title) {
        title = el.find("h2").text().trim();
      }
      
      // Extract image URL from img tag within the link
      const imageEl = el.find("img");
      let imageUrl: string | null = null;
      
      if (imageEl.length > 0) {
        imageUrl = imageEl.attr("src")?.trim() || null;
      }

      // Log extracted data for debugging
      logger.debug(`IndeksOnline: Extracted - URL: ${articleUrl}, Title: ${title?.substring(0, 50)}..., Image: ${imageUrl}`);

      // Validate required fields
      if (!articleUrl || !title) {
        logger.warn(`IndeksOnline: Missing required data - URL: ${!!articleUrl}, Title: ${!!title}`);
        return null;
      }

      // Skip if URL doesn't contain indeksonline.net (might be external links)
      if (!articleUrl.includes('indeksonline.net')) {
        logger.debug(`IndeksOnline: Skipping external URL: ${articleUrl}`);
        return null;
      }

      return {
        title: title, // Keep the title exactly as-is
        url: this.ensureAbsoluteUrl(articleUrl),
        imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
        publicationDate: defaultDate,
        publicationSource: this.config.name,
      };
    } catch (error) {
      logger.error("IndeksOnline: Error extracting article data", { error });
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