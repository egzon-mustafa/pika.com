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

    const page = Math.max(1, Number(pageParam) || 1);
    // Default to 10, cap at 50 to prevent excessively large responses
    const limit = Math.min(50, Math.max(1, Number(limitParam) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("publication_date", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return new Response(JSON.stringify({ page, limit, data: data ?? [] }), {
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

  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/all-articles' \
    --header 'Authorization: Bearer <your_anon_jwt>'

*/
