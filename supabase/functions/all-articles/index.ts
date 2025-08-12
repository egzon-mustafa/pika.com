// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

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

    const page = Math.max(1, Number(pageParam) || 1);
    // Default to 10, cap at 50 to prevent excessively large responses
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

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

    const { data, error } = await query.range(from, to);

    if (error) throw error;

    const response = {
      page,
      limit,
      providers: providers || null,
      data: data ?? []
    };

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

  # Get all articles (default behavior)
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get articles from specific providers
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?providers=telegrafi,insajderi' \
    --header 'Authorization: Bearer <your_anon_jwt>'

  # Get articles from single provider with pagination
  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles?providers=telegrafi&page=2&limit=20' \
    --header 'Authorization: Bearer <your_anon_jwt>'

*/
