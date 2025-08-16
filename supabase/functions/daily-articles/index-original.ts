// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { filterDuplicateArticles, clearCaches, sortArticlesByPriority, getTenDailyArticles } from "@/services/duplicate-filter.ts";
import { getOptimizedDailyArticlesV2, getOptimizedDailyArticlesNoFilterV2 } from "@/services/optimized-filter.ts";
import { Article } from "@/types";

// Response interface for better type safety
interface ApiResponse {
  total_fetched: number;
  providers_included: string[];
  filtering_applied: boolean;
  similarity_threshold?: number;
  total_after_filtering: number;
  data: Article[];
}

function getSupabaseClient() {
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
    const startTime = performance.now(); // Track total request time
    
    const url = new URL(req.url);
    const providersParam = url.searchParams.get("providers");
    const similarityParam = url.searchParams.get("similarity_threshold");

    // Parse providers parameter - comma-separated list
    const providers = providersParam
      ? providersParam.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : null;

    const supabase = getSupabaseClient();
    
    // OPTIMIZATION: Fetch only what we need for 10 articles
    // 3 per provider × 6 providers = 18 articles max needed
    const articlesNeeded = providers ? Math.min(18, providers.length * 3) : 18;
    
    let query = supabase
      .from("articles")
      .select("title, url, publication_source, created_at")
      .order("created_at", { ascending: false })
      .limit(articlesNeeded); // Optimized fetch size

    // Add provider filtering if specified
    if (providers && providers.length > 0) {
      query = query.in("publication_source", providers);
    }

    const { data, error } = await query;

    if (error) throw error;

    // All available providers in priority order
    const allProviders = ["Telegrafi", "Insajderi", "indeksonline", "gazeta-express", "botasot", "gazeta-blic"];
    const responseProviders = providers || allProviders;

    const originalData = data as Article[] ?? [];
    let processedData = originalData;
    
    // Parse and validate similarity threshold with comprehensive error handling
    let similarityThreshold: number | null = null;
    
    try {
      if (similarityParam === "none" || similarityParam === "false" || similarityParam === "0") {
        // Explicitly disable filtering
        similarityThreshold = null;
      } else if (similarityParam) {
        // Validate and parse custom threshold
        const parsedThreshold = Number(similarityParam);
        
        if (isNaN(parsedThreshold)) {
          throw new Error(`Invalid similarity_threshold: "${similarityParam}". Must be a number between 0.5 and 0.95, or "none" to disable.`);
        }
        
        if (parsedThreshold < 0.5 || parsedThreshold > 0.95) {
          throw new Error(`similarity_threshold must be between 0.5 and 0.95. Received: ${parsedThreshold}`);
        }
        
        similarityThreshold = parsedThreshold;
      } else {
        // Default to 0.85
        similarityThreshold = 0.85;
      }
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        error: "Invalid similarity_threshold parameter", 
        details: parseError instanceof Error ? parseError.message : String(parseError),
        valid_values: "Number between 0.5-0.95, or 'none'/'false'/'0' to disable"
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 400,
      });
    }

    // OPTIMIZATION: Use the optimized single-pass algorithm
    try {
      const processStartTime = performance.now();
      
      // Use optimized algorithm based on filtering preference
      if (similarityThreshold !== null) {
        processedData = getOptimizedDailyArticlesV2(originalData, similarityThreshold);
      } else {
        // Even faster when no filtering needed
        processedData = getOptimizedDailyArticlesNoFilterV2(originalData);
      }
      
      const processTime = performance.now() - processStartTime;
      
      // Log performance metrics
      if (processTime > 10) {
        console.warn(`Processing took ${processTime.toFixed(2)}ms for ${originalData.length} articles`);
      }
      
    } catch (filterError) {
      return new Response(JSON.stringify({ 
        error: "Processing failed", 
        details: filterError instanceof Error ? filterError.message : String(filterError)
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 500,
      });
    }
    
    // Validate processed data
    if (!Array.isArray(processedData)) {
      throw new Error("Processing returned invalid data");
    }
    
    // Get list of providers actually included in the response
    const includedProviders = [...new Set(processedData.map(article => article.publication_source))];

    // Construct type-safe response
    const response: ApiResponse = {
      total_fetched: originalData.length,
      providers_included: includedProviders,
      filtering_applied: similarityThreshold !== null,
      total_after_filtering: processedData.length,
      similarity_threshold: similarityThreshold,
      data: processedData
    };

    // Periodically clear caches to prevent memory leaks (every 100 requests roughly)
    if (Math.random() < 0.01) {
      clearCaches();
    }

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60", // Cache for 1 minute
        "X-Response-Time": `${(performance.now() - startTime).toFixed(2)}ms`,
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

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  # Get daily highlights (1 article per provider)
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get daily highlights from specific providers
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?providers=Telegrafi,Insajderi' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get daily highlights with custom similarity threshold
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?similarity_threshold=0.8' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Disable filtering completely
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?similarity_threshold=none' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  Note: This endpoint returns exactly 10 articles with smart distribution across providers 
  based on priority ranking and recency. The providers are ranked as follows:
  1. Telegrafi (highest priority) - gets up to 3 articles
  2. Insajderi - gets up to 2 articles
  3. IndeksOnline - gets up to 2 articles
  4. Gazeta Express - gets up to 2 articles
  5. BotaSot - gets up to 2 articles
  6. Gazeta Blic (lowest priority) - gets up to 2 articles
  
  Distribution algorithm:
  - MANDATORY: Each provider gets exactly 1 article (6 articles total)
  - PRIORITY-BASED: Remaining 4 slots distributed by priority (Telegrafi gets preference)
  
  Expected response: Exactly 10 articles with balanced provider representation.

*/