/**
 * GazetaBlic.com news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions, Provider, getProviderUrl, getProviderUserAgent } from "../types/index.ts";
import { logger } from "../utils/logger.ts";

export class GazetaBlicProvider extends BaseProvider {
  private readonly homeUrl = "https://gazetablic.com/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: Provider.GAZETA_BLIC,
      baseUrl: getProviderUrl(Provider.GAZETA_BLIC),
      userAgent: getProviderUserAgent(Provider.GAZETA_BLIC),
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    const articles: Article[] = [];

    logger.scraping("GazetaBlic: Scraping articles", { url: this.homeUrl });

    try {
      const pageArticles = await this.scrapePage(this.homeUrl);
      articles.push(...pageArticles);

      logger.success(`GazetaBlic: Successfully scraped ${articles.length} articles`);
    } catch (error) {
      logger.error("GazetaBlic: Error scraping articles", { error });
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
      logger.debug("GazetaBlic: Page loaded and parsed", { 
        htmlLength: html.length, 
        pageTitle: $('title').text().trim(),
      });

      // Find all article elements in the featured slider
      // Target: li elements with classes "zgjedhet_slide pdk_tag blic_featured"
      let articleElements = $(".zgjedhjet_slider li.zgjedhet_slide.pdk_tag.blic_featured").toArray();
      
      logger.debug(`GazetaBlic: Found ${articleElements.length} article elements with specific classes`);

      // Fallback: if the specific selector doesn't work, try broader selectors
      if (articleElements.length === 0) {
        articleElements = $(".zgjedhjet_slider li.zgjedhet_slide").toArray();
        logger.debug(`GazetaBlic: Fallback 1 - Found ${articleElements.length} li elements with zgjedhet_slide class`);
        
        if (articleElements.length === 0) {
          articleElements = $(".zgjedhjet_slider li").toArray();
          logger.debug(`GazetaBlic: Fallback 2 - Found ${articleElements.length} all li elements in slider`);
          
          if (articleElements.length === 0) {
            // Final fallback: look for any li with a link
            articleElements = $("li").filter((_, el) => $(el).find("a").length > 0).toArray();
            logger.debug(`GazetaBlic: Final fallback - Found ${articleElements.length} li elements with links`);
          }
        }
      }

      logger.processing(`GazetaBlic: Processing ${articleElements.length} elements`);

      for (const [index, item] of articleElements.entries()) {
        try {
          logger.debug(`GazetaBlic: Processing item ${index + 1}/${articleElements.length}`);
          const article = this.extractArticleData($, item);
          if (article && this.validateArticle(article)) {
            articles.push(article);
            logger.success(`GazetaBlic: Successfully extracted article: ${article.title.substring(0, 50)}...`);
          }
        } catch (error) {
          logger.warn(`GazetaBlic: Error extracting article data from item ${index + 1}`, { error });
        }
      }

    } catch (error) {
      logger.error(`GazetaBlic: Failed to scrape page ${pageUrl}`, { error });
      throw error;
    }

    return articles;
  }

  private extractArticleData($: any, element: any): Article | null {
    try {
      const el = $(element);
      
      // Find the article link (a tag within the li)
      const articleLink = el.find("a").first();
      
      if (articleLink.length === 0) {
        logger.warn("GazetaBlic: No article link found in element");
        return null;
      }

      // Extract article URL from href attribute
      const articleUrl = articleLink.attr("href")?.trim();
      
      // Extract title from h1 element within article_box_content
      const title = articleLink.find(".article_box_content h1").text().trim() ||
                   articleLink.find("h1").text().trim();
      
      // Extract image URL from img element within thumb-holder
      const imageUrl = articleLink.find(".thumb-holder img").attr("src")?.trim() || 
                     articleLink.find("img").attr("src")?.trim() || null;
      
      // Extract publication date from span with class "date-time date-human"
      const publicationDate = articleLink.find(".article_box_content .date-time.date-human").text().trim() ||
                             articleLink.find(".date-time.date-human").text().trim() ||
                             "Sot";

      // Log extracted data for debugging
      logger.debug(`GazetaBlic: Extracted - URL: ${articleUrl}, Title: ${title?.substring(0, 50)}..., Image: ${imageUrl}, Date: ${publicationDate}`);

      // Validate required fields
      if (!articleUrl || !title) {
        logger.warn(`GazetaBlic: Missing required data - URL: ${!!articleUrl}, Title: ${!!title}`);
        return null;
      }

      return {
        title: title,
        url: this.ensureAbsoluteUrl(articleUrl),
        imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
        publicationDate: publicationDate,
        publicationSource: this.config.name,
      };
    } catch (error) {
      logger.error("GazetaBlic: Error extracting article data", { error });
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