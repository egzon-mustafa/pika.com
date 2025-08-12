/**
 * Insajderi.org news provider implementation
 */

import { load as loadHtmlToCheerio } from "cheerio";
import { Article, BaseProvider, ProviderConfig, ScrapingOptions } from "../types/index.ts";

export class InsajderiProvider extends BaseProvider {
  private readonly categoryUrl = "https://insajderi.org/category/lajme/";

  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "insajderi",
      baseUrl: "https://insajderi.org",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };

    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    const articles: Article[] = [];

    console.log(`🔍 Insajderi: Scraping articles from ${this.categoryUrl}`);

    try {
      const pageArticles = await this.scrapePage(this.categoryUrl);
      articles.push(...pageArticles);

      console.log(`✅ Insajderi: Successfully scraped ${articles.length} articles`);
    } catch (error) {
      console.error(`❌ Insajderi: Error scraping articles:`, error);
    }

    return articles;
  }

  private async scrapePage(pageUrl: string): Promise<Article[]> {
    const articles: Article[] = [];

    try {
      const response = await this.fetchWithRetry(pageUrl);
      const html = await response.text();
      const $ = loadHtmlToCheerio(html);

      // Use a placeholder date since Insajderi doesn't show explicit dates
      const defaultDate = "Sot"; // "Today" in Albanian

      // Extract main featured article
      const mainArticle = this.extractMainArticle($, defaultDate);
      if (mainArticle && this.validateArticle(mainArticle)) {
        articles.push(mainArticle);
      }

      // Extract additional articles
      const additionalArticles = this.extractAdditionalArticles($, defaultDate);
      articles.push(...additionalArticles.filter(article => 
        article && this.validateArticle(article)
      ));

    } catch (error) {
      console.error(`❌ Insajderi: Failed to scrape page ${pageUrl}:`, error);
      throw error;
    }

    return articles;
  }

  private extractMainArticle($: any, defaultDate: string): Article | null {
    try {
      // Main featured article inside .hulumtime > .hu1 > .hulumtime1
      const main = $("div.hulumtime div.hu1 div.hulumtime1");
      
      if (main.length === 0) {
        console.warn("⚠️ Insajderi: Main article container not found");
        return null;
      }

      const mainTitleEl = main.find("div.kape div.titulli a");
      const title = mainTitleEl.text().trim();
      const articleUrl = mainTitleEl.attr("href")?.trim();
      const imageUrl = main.find("div.foto a img").attr("src")?.trim() || null;

      if (!articleUrl || !title) {
        console.warn("⚠️ Insajderi: Main article missing required data");
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
      console.error("❌ Insajderi: Error extracting main article:", error);
      return null;
    }
  }

  private extractAdditionalArticles($: any, defaultDate: string): Article[] {
    const articles: Article[] = [];

    try {
      // Additional articles: .hulumtime > .hu2 > .hulumtime2
      const others = $("div.hulumtime div.hu2 div.hulumtime2").toArray();

      for (const element of others) {
        try {
          const el = $(element);
          const titleEl = el.find("div.titulli a");
          const title = titleEl.text().trim();
          const articleUrl = titleEl.attr("href")?.trim();
          const imageUrl = el.find("div.foto a img").attr("src")?.trim() || null;

          if (!articleUrl || !title) {
            continue;
          }

          const article: Article = {
            title: title, // Keep the title exactly as-is
            url: this.ensureAbsoluteUrl(articleUrl),
            imageUrl: imageUrl ? this.ensureAbsoluteUrl(imageUrl) : null,
            publicationDate: defaultDate,
            publicationSource: this.config.name,
          };

          articles.push(article);
        } catch (error) {
          console.warn("⚠️ Insajderi: Error extracting additional article:", error);
        }
      }
    } catch (error) {
      console.error("❌ Insajderi: Error extracting additional articles:", error);
    }

    return articles;
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