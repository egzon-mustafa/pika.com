/**
 * Core types and interfaces for the gazeta-blic crawler
 */

export interface Article {
  title: string;
  url: string;
  imageUrl: string | null;
  publicationDate: string;
  publicationSource: string;
}

export interface DatabaseArticle {
  title: string;
  url: string;
  image_url: string | null;
  publication_date: string;
  publication_source: string;
}

export interface CrawlerResult {
  totalArticlesFetched: number;
  provider: string;
  errors?: string[];
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  userAgent?: string;
  requestDelay?: number;
  maxRetries?: number;
}

export interface ScrapingOptions {
  maxPages?: number;
  respectRobotsTxt?: boolean;
  requestDelay?: number;
  maxRetries?: number;
}

export interface ProviderResult {
  providerName: string;
  articlesFetched: number;
  errors: string[];
  success: boolean;
}

export enum Provider {
  GAZETA_BLIC = "gazeta-blic",
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected options: ScrapingOptions;

  constructor(config: ProviderConfig, options: ScrapingOptions = {}) {
    this.config = config;
    this.options = {
      maxPages: 5,
      respectRobotsTxt: true,
      requestDelay: 1000,
      maxRetries: 3,
      ...options,
    };
  }

  abstract scrapeArticles(): Promise<Article[]>;
  
  protected async fetchWithRetry(url: string, retries = 0): Promise<Response> {
    const maxRetries = this.options.maxRetries || 3;
    
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": this.config.userAgent || 
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (retries < maxRetries) {
        console.warn(`Fetch failed for ${url}, retrying... (${retries + 1}/${maxRetries})`);
        await this.delay(1000 * (retries + 1)); // Exponential backoff
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateArticle(article: Partial<Article>): article is Article {
    return !!(
      article.title?.trim() &&
      article.url?.trim() &&
      article.publicationDate &&
      article.publicationSource
    );
  }
}