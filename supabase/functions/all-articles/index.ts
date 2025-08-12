// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { filterDuplicateArticles, clearCaches } from "@/services/duplicate-filter.ts";
import { Article } from "@/types";

// Response interface for better type safety
interface ApiResponse {
  page: number;
  limit: number;
  providers: string[] | null;
  total_fetched: number;
  total_pages_available: number;
  has_next_page: boolean;
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
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page");
    const limitParam = url.searchParams.get("limit");
    const providersParam = url.searchParams.get("providers");
    const similarityParam = url.searchParams.get("similarity_threshold");

    const page = Math.max(1, Number(pageParam) || 1);
    // Default to 10, cap at 50 to prevent excessively large responses
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 10));
    
    // For filtering duplicates, we need to fetch more articles to ensure we have enough unique ones
    // Use a reasonable multiplier to account for duplicates without making requests too large
    const fetchMultiplier = 2.5; // Conservative multiplier to account for duplicates
    const baseFetchSize = limit * fetchMultiplier;
    const additionalForPagination = (page - 1) * limit;
    const fetchLimit = Math.min(100, Math.ceil(baseFetchSize + additionalForPagination)); // Cap at 100 to prevent 413 errors

    // Parse providers parameter - comma-separated list
    const providers = providersParam
      ? providersParam.split(',').map(p => p.trim()).filter(p => p.length > 0)
      : null;

    const supabase = getSupabaseClient();
    let query = supabase
      .from("articles")
      .select("title, url, publication_source, created_at")
      .order("created_at", { ascending: false });

    // Add provider filtering if specified
    if (providers && providers.length > 0) {
      query = query.in("publication_source", providers);
    }

    // Fetch from the beginning to apply filtering consistently
    const { data, error } = await query.range(0, fetchLimit - 1);

    if (error) throw error;

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

    // Apply filtering unless explicitly disabled with error handling
    try {
      if (similarityThreshold !== null) {
        const startTime = performance.now();
        processedData = filterDuplicateArticles(originalData, similarityThreshold);
        const filteringTime = performance.now() - startTime;
        
        // Log performance warning if filtering takes too long
        if (filteringTime > 1000) {
          console.warn(`Filtering took ${filteringTime.toFixed(2)}ms for ${originalData.length} articles`);
        }
      }
    } catch (filterError) {
      return new Response(JSON.stringify({ 
        error: "Filtering failed", 
        details: filterError instanceof Error ? filterError.message : String(filterError)
      }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 500,
      });
    }
    
    // Validate processed data
    if (!Array.isArray(processedData)) {
      throw new Error("Filtering returned invalid data");
    }
    
    // Apply pagination to the processed results with bounds checking
    const startIndex = Math.max(0, (page - 1) * limit);
    const endIndex = startIndex + limit;
    const paginatedData = processedData.slice(startIndex, endIndex);
    
    // Check if we have enough results for the requested page
    const hasNextPage = processedData.length > endIndex;
    const totalAvailablePages = Math.max(1, Math.ceil(processedData.length / limit));

    // Construct type-safe response
    const response: ApiResponse = {
      page,
      limit,
      providers: providers || null,
      total_fetched: originalData.length,
      total_pages_available: totalAvailablePages,
      has_next_page: hasNextPage,
      filtering_applied: similarityThreshold !== null,
      total_after_filtering: processedData.length,
      data: paginatedData
    };

    // Include similarity threshold only when filtering is applied
    if (similarityThreshold !== null) {
      response.similarity_threshold = similarityThreshold;
    }

    // Periodically clear caches to prevent memory leaks (every 100 requests roughly)
    if (Math.random() < 0.01) {
      clearCaches();
    }

    return new Response(JSON.stringify(response), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
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

  # Get all articles (default filtering with threshold 0.85)
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get articles from specific providers
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?providers=telegrafi,insajderi' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get articles with custom similarity threshold (0.5-0.95, e.g., 0.8)
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?similarity_threshold=0.8' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Disable filtering completely
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?similarity_threshold=none' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get articles from single provider with pagination and custom filtering
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?providers=telegrafi&page=2&limit=20&similarity_threshold=0.9' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  Note: Duplicate filtering is ENABLED BY DEFAULT with threshold 0.85. The API filters 
  duplicate articles based on title similarity using Jaro-Winkler distance algorithm. 
  When duplicate articles are found across different providers, the system prioritizes 
  articles based on provider ranking (telegrafi > gazeta-express > insajderi > gazeta-blic) 
  and recency.
  
  Higher similarity_threshold values (closer to 1.0) are more strict and will filter fewer 
  articles. Lower values (closer to 0.5) are more aggressive and will filter more similar 
  articles. Use similarity_threshold=none to disable filtering completely.
  
  The API is optimized to prevent request entity too large errors by limiting fetch sizes while
  still providing effective duplicate filtering. Response includes pagination metadata to help
  with navigation through filtered results.

*/
