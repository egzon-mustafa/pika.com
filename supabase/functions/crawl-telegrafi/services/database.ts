/**
 * Database service for handling article operations with Supabase
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Article, DatabaseArticle } from "../types/index.ts";
import { logger } from "../utils/logger.ts";

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = this.getSupabaseClient();
  }

  private getSupabaseClient(): SupabaseClient {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL environment variable");
    }

    const keyToUse = serviceRoleKey ?? anonKey;
    if (!keyToUse) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY",
      );
    }

    return createClient(supabaseUrl, keyToUse);
  }

  async loadExistingArticleUrls(): Promise<Set<string>> {
    const existingArticles = new Set<string>();

    try {
      const { data, error } = await this.supabase
        .from("articles")
        .select("url");

      if (error) {
        logger.error("Error loading existing articles", { error });
        throw error;
      }

      if (data) {
        for (const article of data) {
          if (article?.url) {
            existingArticles.add(article.url);
          }
        }
      }

      logger.info(`Loaded ${existingArticles.size} existing articles from database`);
    } catch (error) {
      logger.error("Failed to load existing articles", { error });
      throw error;
    }

    return existingArticles;
  }

  async checkProviderStatus(providerName: string): Promise<boolean> {
    try {
      logger.info(`Querying provider status for: "${providerName}"`);
      
      const { data, error } = await this.supabase
        .from("providers")
        .select("is_active, name")
        .eq("name", providerName)
        .single();

      if (error) {
        logger.error(`Error checking provider status for ${providerName}`, { error });
        
        // If no matching provider found, let's check what providers exist
        logger.info("Checking all available providers...");
        const { data: allProviders } = await this.supabase
          .from("providers")
          .select("name, is_active");
        
        if (allProviders) {
          logger.info(`Available providers:`, { providers: allProviders });
        }
        
        return false;
      }

      logger.info(`Provider "${providerName}" status:`, { 
        name: data.name, 
        is_active: data.is_active, 
        type: typeof data.is_active 
      });

      const isActive = data?.is_active === true;
      logger.info(`Final result for ${providerName}: ${isActive}`);
      
      return isActive;
    } catch (error) {
      logger.error(`Failed to check provider status for ${providerName}`, { error });
      return false;
    }
  }

  async saveArticle(article: Article): Promise<boolean> {
    if (!article) {
      logger.warn("Cannot save null or undefined article");
      return false;
    }

    try {
      const databaseArticle: DatabaseArticle = {
        title: article.title,
        url: article.url,
        image_url: article.imageUrl,
        publication_date: article.publicationDate,
        publication_source: article.publicationSource,
      };

      const { error } = await this.supabase
        .from("articles")
        .insert([databaseArticle]);

      if (error) {
        logger.error("Error saving article to database", { error });
        return false;
      }

      logger.info(`Saved article: ${article.title}`);
      return true;
    } catch (error) {
      logger.error("Error in saveArticle", { error });
      return false;
    }
  }

  async saveArticles(articles: Article[], batchSize = 10): Promise<number> {
    let savedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      
      try {
        const results = await Promise.allSettled(
          batch.map(article => this.saveArticle(article))
        );

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            savedCount++;
          } else if (result.status === "rejected") {
            errors.push(result.reason?.message || "Unknown error");
          }
        }

        // Add a small delay between batches to be respectful
        if (i + batchSize < articles.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`Error processing batch ${i}-${i + batchSize}`, { error });
        errors.push(`Batch error: ${error}`);
      }
    }

    if (errors.length > 0) {
      logger.warn(`${errors.length} errors occurred while saving articles`, { errors });
    }

    return savedCount;
  }

  async getStatistics(): Promise<{
    totalArticles: number;
    articlesBySource: Record<string, number>;
  }> {
    try {
      const { data: totalData, error: totalError } = await this.supabase
        .from("articles")
        .select("*", { count: "exact", head: true });

      if (totalError) {
        throw totalError;
      }

      const { data: sourceData, error: sourceError } = await this.supabase
        .from("articles")
        .select("publication_source");

      if (sourceError) {
        throw sourceError;
      }

      const articlesBySource: Record<string, number> = {};
      if (sourceData) {
        for (const article of sourceData) {
          const source = article.publication_source;
          articlesBySource[source] = (articlesBySource[source] || 0) + 1;
        }
      }

      return {
        totalArticles: totalData?.length || 0,
        articlesBySource,
      };
    } catch (error) {
      logger.error("Error getting database statistics", { error });
      return {
        totalArticles: 0,
        articlesBySource: {},
      };
    }
  }
}