// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";
import { getSmartDailyArticles, getSmartDailyArticlesNoFilter } from "@/services/smart-filter.ts";
import { Article } from "@/types";

// Response interface for better type safety
interface ApiResponse {
  date: string;
  total_fetched: number;
  providers_included: string[];
  filtering_applied: boolean;
  similarity_threshold?: number;
  total_after_filtering: number;
  data: Article[];
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

// Get date range for today in UTC
function getTodayDateRange(): { start: string; end: string } {
  const now = new Date();
  
  // Start of today (00:00:00 UTC)
  const startOfToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  
  // End of today (23:59:59.999 UTC)
  const endOfToday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23, 59, 59, 999
  ));
  
  return {
    start: startOfToday.toISOString(),
    end: endOfToday.toISOString()
  };
}

// Fetch all articles from today
async function fetchTodaysArticles(providers?: string[] | null): Promise<Article[]> {
  const supabase = getSupabaseClient();
  const { start, end } = getTodayDateRange();
  
  console.log(`Fetching articles from ${start} to ${end}`);
  
  // Build query for today's articles
  let query = supabase
    .from("articles")
    .select("title, url, publication_source, created_at")
    .gte("created_at", start)
    .lte("created_at", end);
  
  // Apply provider filter if specified
  if (providers && providers.length > 0) {
    query = query.in("publication_source", providers);
  }
  
  // Order by created_at descending to get newest first
  const { data, error } = await query
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  
  const articles = (data as Article[]) ?? [];
  console.log(`Found ${articles.length} articles for today`);
  
  return articles;
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

    // Fetch all of today's articles
    const fetchStartTime = performance.now();
    const todaysArticles = await fetchTodaysArticles(providers);
    const fetchTime = performance.now() - fetchStartTime;
    
    // Apply smart filtering algorithm
    const processStartTime = performance.now();
    let processedData: Article[];
    
    if (similarityThreshold !== null) {
      processedData = getSmartDailyArticles(todaysArticles, similarityThreshold);
    } else {
      processedData = getSmartDailyArticlesNoFilter(todaysArticles);
    }
    
    const processTime = performance.now() - processStartTime;
    
    // Get list of providers actually included
    const includedProviders = [...new Set(processedData.map(article => article.publication_source))];
    
    // Get today's date for the response
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Construct response
    const response: ApiResponse = {
      date: dateStr,
      total_fetched: todaysArticles.length,
      providers_included: includedProviders,
      filtering_applied: similarityThreshold !== null,
      total_after_filtering: processedData.length,
      similarity_threshold: similarityThreshold,
      data: processedData
    };

    const totalTime = performance.now() - startTime;
    
    // Log performance metrics
    console.log(`Performance: Total ${totalTime.toFixed(2)}ms (Fetch: ${fetchTime.toFixed(2)}ms, Process: ${processTime.toFixed(2)}ms)`);
    console.log(`Today's articles: Fetched ${todaysArticles.length}, Returned ${processedData.length}`);

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
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

/* Smart Daily Articles Strategy:
 * 
 * 1. DATE-BASED FILTERING: Fetch only articles from today (UTC)
 * 2. NO ARBITRARY LIMITS: Return all quality articles from today
 * 3. INTELLIGENT FILTERING: Apply duplicate detection and ranking
 * 4. PROVIDER DIVERSITY: Ensure good mix of sources when possible
 * 5. REAL-TIME FRESHNESS: Always shows today's actual content
 * 
 * Benefits:
 * - Shows all important news from today
 * - No missing stories due to 10-article limit
 * - Adapts to news volume (more on busy days, less on quiet days)
 * - True daily digest of quality content
 */