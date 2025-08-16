// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";
import { getOptimizedDailyArticlesV2, getOptimizedDailyArticlesNoFilterV2 } from "@/services/optimized-filter-v2.ts";
import { Article } from "@/types";

// Response interface for better type safety
interface ApiResponse {
  total_fetched: number;
  providers_included: string[];
  filtering_applied: boolean;
  similarity_threshold?: number;
  total_after_filtering: number;
  data: Article[];
  fetch_iterations?: number;
}

// Cache the Supabase client
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  
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

  supabaseClient = createClient(supabaseUrl, keyToUse);
  return supabaseClient;
}

// Progressive fetching strategy to ensure we always get 10 articles
async function fetchArticlesWithFallback(
  providers?: string[] | null,
  similarityThreshold?: number | null
): Promise<{ articles: Article[], iterations: number }> {
  const supabase = getSupabaseClient();
  const targetCount = 10;
  const allArticles: Article[] = [];
  let offset = 0;
  let iterations = 0;
  const maxIterations = 5; // Safety limit
  
  // Start with a reasonable batch size
  let batchSize = providers ? Math.max(20, providers.length * 4) : 30;
  
  while (allArticles.length < targetCount && iterations < maxIterations) {
    iterations++;
    
    // Build query
    let query = supabase
      .from("articles")
      .select("title, url, publication_source, created_at");
    
    if (providers && providers.length > 0) {
      query = query.in("publication_source", providers);
    }
    
    // Fetch next batch
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + batchSize - 1);
      
    if (error) throw error;
    
    const newArticles = (data as Article[]) ?? [];
    
    // If no more articles available, break
    if (newArticles.length === 0) break;
    
    // If no filtering, just add and check count
    if (similarityThreshold === null) {
      allArticles.push(...newArticles);
      if (allArticles.length >= targetCount) break;
    } else {
      // With filtering, we need to check after each batch
      const combined = [...allArticles, ...newArticles];
      const filtered = getOptimizedDailyArticles(combined, similarityThreshold);
      
      // If we have enough articles after filtering, we're done
      if (filtered.length >= targetCount) {
        return { 
          articles: combined, // Return all fetched articles for final processing
          iterations 
        };
      }
      
      allArticles.push(...newArticles);
    }
    
    offset += batchSize;
    // Increase batch size for next iteration if needed
    batchSize = Math.min(50, batchSize * 1.5);
  }
  
  return { articles: allArticles, iterations };
}

Deno.serve(async (req) => {
  // Allow simple CORS for browser callers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
      },
      status: 204,
    });
  }

  try {
    const startTime = performance.now();
    
    const url = new URL(req.url);
    const providersParam = url.searchParams.get("providers");
    const similarityParam = url.searchParams.get("similarity_threshold");

    // Parse providers parameter
    const providers = providersParam
      ? providersParam.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : null;

    // Optimized similarity threshold parsing
    let similarityThreshold: number | null = 0.85;
    if (similarityParam === "none" || similarityParam === "false" || similarityParam === "0") {
      similarityThreshold = null;
    } else if (similarityParam) {
      const parsed = Number(similarityParam);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 0.95) {
        similarityThreshold = parsed;
      }
    }

    // Fetch with progressive strategy
    const fetchStartTime = performance.now();
    const { articles, iterations } = await fetchArticlesWithFallback(providers, similarityThreshold);
    const fetchTime = performance.now() - fetchStartTime;
    
    // Apply optimized algorithm
    const processStartTime = performance.now();
    let processedData: Article[];
    
    if (similarityThreshold !== null) {
      processedData = getOptimizedDailyArticlesV2(articles, similarityThreshold);
    } else {
      processedData = getOptimizedDailyArticlesNoFilterV2(articles);
    }
    
    // CRITICAL: Ensure we always return exactly 10 articles (or all available if less)
    const targetCount = 10;
    if (processedData.length < targetCount && articles.length > processedData.length) {
      // If we don't have enough after filtering, add more from unfiltered
      // This ensures we always return 10 articles when possible
      const used = new Set(processedData.map(a => a.url));
      const remaining = articles.filter(a => !used.has(a.url));
      
      let added = 0;
      for (const article of remaining) {
        if (processedData.length >= targetCount) break;
        processedData.push(article);
        added++;
      }
      
      if (added > 0) {
        console.log(`Added ${added} additional articles to reach target count`);
      }
    }
    
    // Final slice to ensure exactly 10
    processedData = processedData.slice(0, targetCount);
    
    const processTime = performance.now() - processStartTime;
    
    // Get list of providers actually included
    const includedProviders = [...new Set(processedData.map(article => article.publication_source))];
    
    // Construct response
    const response: ApiResponse = {
      total_fetched: articles.length,
      providers_included: includedProviders,
      filtering_applied: similarityThreshold !== null,
      total_after_filtering: processedData.length,
      similarity_threshold: similarityThreshold,
      data: processedData,
      fetch_iterations: iterations
    };

    const totalTime = performance.now() - startTime;
    
    // Log performance metrics
    console.log(`Performance: Total ${totalTime.toFixed(2)}ms (Fetch: ${fetchTime.toFixed(2)}ms [${iterations} iterations], Process: ${processTime.toFixed(2)}ms)`);
    console.log(`Articles: Fetched ${articles.length}, Returned ${processedData.length}`);

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60", // Cache for 1 minute
      },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 500,
    });
  }
});

/* Enhanced Performance Strategy:
 * 
 * 1. PROGRESSIVE FETCHING: Start with 30 articles, fetch more if needed after filtering
 * 2. GUARANTEED 10 ARTICLES: Always return exactly 10 articles when available
 * 3. SMART BATCHING: Increase batch size progressively to minimize DB calls
 * 4. FALLBACK MECHANISM: If filtering is too aggressive, add unfiltered articles
 * 5. CACHED CLIENT: Reuse Supabase client instance
 * 6. HTTP CACHING: Added Cache-Control header for 1-minute browser caching
 * 
 * Expected Performance:
 * - Most requests: 1 fetch iteration (~30-40ms total)
 * - High duplicate scenarios: 2-3 iterations (~50-80ms total)
 * - Always returns exactly 10 articles when available
 */