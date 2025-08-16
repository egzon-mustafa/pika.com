/**
 * Track Article View and Update Usage
 * 
 * This function tracks when a user views an article and updates their daily usage.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { articleId } = await req.json();
    if (!articleId) {
      return new Response(
        JSON.stringify({ error: "Article ID is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Convert articleId to integer since articles.id is int8
    const articleIdInt = parseInt(articleId.toString());
    if (isNaN(articleIdInt)) {
      return new Response(
        JSON.stringify({ error: "Invalid article ID format" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];
    const userAgent = req.headers.get("User-Agent");
    const clientIP = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    // Check if user has already viewed this article today (prevent duplicate counts)
    const { data: existingView } = await supabase
      .from("article_views")
      .select("id")
      .eq("user_id", userId)
      .eq("article_id", articleIdInt)
      .gte("viewed_at", `${today}T00:00:00.000Z`)
      .single();

    if (existingView) {
      // Already viewed today, don't count again
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Article view already recorded today" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Record the article view
    await supabase
      .from("article_views")
      .insert({
        user_id: userId,
        article_id: articleIdInt,
        ip_address: clientIP,
        user_agent: userAgent
      });

    // Update or create daily usage
    const { data: existingUsage } = await supabase
      .from("daily_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single();

    if (existingUsage) {
      // Update existing usage
      await supabase
        .from("daily_usage")
        .update({
          articles_viewed: existingUsage.articles_viewed + 1,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingUsage.id);
    } else {
      // Create new usage record
      await supabase
        .from("daily_usage")
        .insert({
          user_id: userId,
          usage_date: today,
          articles_viewed: 1
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Article view tracked successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Track article view error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});