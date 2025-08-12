/**
 * GazetaExpress.com news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions } from "../types/index.ts";

export class GazetaExpressProvider extends BaseProvider {
  private readonly homeUrl = "https://www.gazetaexpress.com/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "gazeta-express",
      baseUrl: "https://www.gazetaexpress.com",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    const articles: Article[] = [];

    console.log(`🔍 GazetaExpress: Scraping articles from ${this.homeUrl}`);

    try {
      const pageArticles = await this.scrapePage(this.homeUrl);
      articles.push(...pageArticles);

      console.log(`✅ GazetaExpress: Successfully scraped ${articles.length} articles`);
    } catch (error) {
      console.error(`❌ GazetaExpress: Error scraping articles:`, error);
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
      console.log(`📄 GazetaExpress: Page loaded, HTML length: ${html.length}`);
      console.log(`📄 GazetaExpress: Page title: ${$('title').text().trim()}`);
      
      // Debug: Check if owl carousel elements exist at all
      const owlStage = $('.owl-stage').length;
      const owlStageOuter = $('.owl-stage-outer').length;
      console.log(`📄 GazetaExpress: Found ${owlStageOuter} owl-stage-outer, ${owlStage} owl-stage elements`);

      // Use a placeholder date since we don't have explicit dates in the provided HTML
      const defaultDate = "Sot"; // "Today" in Albanian

      // Try multiple selectors to find articles
      let articleElements: any[] = [];
      
      // First try: Find all active owl-item elements (usually 4 but can be more)
      const activeItems = $(".owl-item.active").toArray();
      console.log(`📰 GazetaExpress: Found ${activeItems.length} active owl items`);
      
      if (activeItems.length > 0) {
        articleElements = activeItems;
      } else {
        // Fallback: Try to find any owl-item (in case .active class is not present)
        const allItems = $(".owl-item").toArray();
        console.log(`📰 GazetaExpress: Found ${allItems.length} total owl items`);
        
        if (allItems.length > 0) {
          articleElements = allItems;
        } else {
          // Last fallback: Try to find articles by the link class directly
          const directLinks = $("a.topstories__item").toArray();
          console.log(`📰 GazetaExpress: Found ${directLinks.length} direct topstories links`);
          articleElements = directLinks;
        }
      }

      console.log(`📰 GazetaExpress: Processing ${articleElements.length} elements`);

      for (const [index, item] of articleElements.entries()) {
        try {
          console.log(`📰 GazetaExpress: Processing item ${index + 1}/${articleElements.length}`);
          const article = this.extractArticleData($, item, defaultDate);
          if (article && this.validateArticle(article)) {
            articles.push(article);
            console.log(`✅ GazetaExpress: Successfully extracted article: ${article.title.substring(0, 50)}...`);
          }
        } catch (error) {
          console.warn(`⚠️ GazetaExpress: Error extracting article data from item ${index + 1}:`, error);
        }
      }

    } catch (error) {
      console.error(`❌ GazetaExpress: Failed to scrape page ${pageUrl}:`, error);
      throw error;
    }

    return articles;
  }

  private extractArticleData($: any, element: any, defaultDate: string): Article | null {
    try {
      const el = $(element);
      let targetLink: any;
      
      // Check if the element itself is a link (from direct link fallback)
      if (el.is("a.topstories__item")) {
        targetLink = el;
        console.log("🔍 GazetaExpress: Element is direct link");
      } else {
        // The structure is: .owl-item.active > .item > .col-12 > a.topstories__item
        const linkEl = el.find(".item .col-12 a.topstories__item");
        
        if (linkEl.length === 0) {
          console.warn("⚠️ GazetaExpress: Link element not found in item");
          // Let's also try direct search for any a tag as fallback
          const anyLink = el.find("a");
          if (anyLink.length === 0) {
            console.warn("⚠️ GazetaExpress: No link found at all in item");
            return null;
          }
          console.log("⚠️ GazetaExpress: Using fallback link selector");
          targetLink = anyLink.first();
        } else {
          targetLink = linkEl;
        }
      }

      // Extract article URL
      const articleUrl = targetLink.attr("href")?.trim();
      
      // Extract title from h3 with classes box__title-background box__title-border
      const title = targetLink.find("h3.box__title-background.box__title-border").text().trim();
      
      // Extract image URL
      const imageUrl = targetLink.find("figure img").attr("src")?.trim() || null;

      // Log extracted data for debugging
      console.log(`🔍 GazetaExpress Debug - URL: ${articleUrl}, Title: ${title}, Image: ${imageUrl}`);

      // Validate required fields
      if (!articleUrl || !title) {
        console.warn("⚠️ GazetaExpress: Missing required data", { 
          url: !!articleUrl, 
          title: !!title,
          rawTitle: title 
        });
        return null;
      }

      return {
        title: this.cleanTitle(title),
        url: this.ensureAbsoluteUrl(articleUrl),
        imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
        publicationDate: defaultDate,
        publicationSource: this.config.name,
      };
    } catch (error) {
      console.error("❌ GazetaExpress: Error extracting article data:", error);
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

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      // Keep Albanian/Unicode letters, spaces, and common punctuation
      // This preserves ë, ç, ã, ú, í, ó, etc. while removing unwanted characters
      .replace(/[^\p{L}\p{N}\s\-.,!?():'"–—""'']/gu, "")
      .trim();
  }
}