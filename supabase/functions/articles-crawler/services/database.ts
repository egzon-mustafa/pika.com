/**
 * Database service for handling article operations with Supabase
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Article, DatabaseArticle } from "@/types";

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

  /**
   * Load all existing article URLs from the database
   */
  async loadExistingArticleUrls(): Promise<Set<string>> {
    const existingArticles = new Set<string>();

    try {
      const { data, error } = await this.supabase
        .from("articles")
        .select("url");

      if (error) {
        console.error("Error loading existing articles:", error);
        throw error;
      }

      if (data) {
        for (const article of data) {
          if (article?.url) {
            existingArticles.add(article.url);
          }
        }
      }

      console.log(
        `Loaded ${existingArticles.size} existing articles from database.`,
      );
    } catch (error) {
      console.error("Failed to load existing articles:", error);
      throw error;
    }

    return existingArticles;
  }

  /**
   * Check if an article already exists in the database
   */
  async articleExists(url: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("articles")
        .select("url")
        .eq("url", url)
        .maybeSingle();

      if (error) {
        console.error("Error checking for existing article:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Error in articleExists:", error);
      return false;
    }
  }

  /**
   * Save a single article to the database
   */
  async saveArticle(article: Article): Promise<boolean> {
    if (!article) {
      console.warn("Cannot save null or undefined article");
      return false;
    }

    try {
      // Check if article already exists
      if (await this.articleExists(article.url)) {
        console.log(`Article already exists: ${article.url}`);
        return false;
      }

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
        console.error(`Error saving article to database:`, error);
        return false;
      }

      console.log(`✓ Saved article: ${article.title}`);
      return true;
    } catch (error) {
      console.error("Error in saveArticle:", error);
      return false;
    }
  }

  /**
   * Save multiple articles to the database in batches
   */
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
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error);
        errors.push(`Batch error: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} errors occurred while saving articles:`, errors);
    }

    return savedCount;
  }

  /**
   * Get database statistics
   */
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
      console.error("Error getting database statistics:", error);
      return {
        totalArticles: 0,
        articlesBySource: {},
      };
    }
  }
}