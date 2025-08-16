/**
 * Check User Subscription Status and Usage Limits
 * 
 * This function checks if a user can view articles based on their subscription
 * and current usage limits.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

interface SubscriptionResponse {
  canViewArticle: boolean;
  subscriptionType: string;
  remainingViews: number | null;
  dailyLimit: number | null;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  message: string;
}

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

    const userId = user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get or create user subscription
    let { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    // If no subscription exists, create free trial
    if (!subscription) {
      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      const { data: newSubscription, error: createError } = await supabase
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          subscription_type: "free_trial",
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      subscription = newSubscription;
    }

    // Check if trial has expired and convert to free
    if (subscription.subscription_type === "free_trial" && subscription.trial_end_date) {
      const trialEndDate = new Date(subscription.trial_end_date);
      const now = new Date();
      
      if (now > trialEndDate) {
        // Convert to free tier
        await supabase
          .from("user_subscriptions")
          .update({
            subscription_type: "free",
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", subscription.id);
        
        subscription.subscription_type = "free";
      }
    }

    // Get daily usage
    let { data: dailyUsage } = await supabase
      .from("daily_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single();

    if (!dailyUsage) {
      // Create daily usage record
      const { data: newUsage } = await supabase
        .from("daily_usage")
        .insert({
          user_id: userId,
          usage_date: today,
          articles_viewed: 0
        })
        .select()
        .single();
      
      dailyUsage = newUsage;
    }

    // Get subscription plan details
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", subscription.subscription_type)
      .single();

    // Determine if user can view article
    let canViewArticle = true;
    let remainingViews: number | null = null;
    let message = "You can view this article";
    let isTrialActive = false;
    let trialDaysRemaining: number | null = null;

    // Check trial status
    if (subscription.subscription_type === "free_trial" && subscription.trial_end_date) {
      isTrialActive = true;
      const trialEnd = new Date(subscription.trial_end_date);
      const now = new Date();
      trialDaysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Check limits based on subscription type
    if (subscription.subscription_type === "free" && plan?.daily_article_limit) {
      const dailyLimit = plan.daily_article_limit;
      const viewsToday = dailyUsage?.articles_viewed || 0;
      remainingViews = Math.max(0, dailyLimit - viewsToday);
      
      if (viewsToday >= dailyLimit) {
        canViewArticle = false;
        message = `You've reached your daily limit of ${dailyLimit} articles. Upgrade to Premium for unlimited access!`;
      } else {
        message = `You have ${remainingViews} articles remaining today`;
      }
    } else if (subscription.subscription_type === "premium") {
      message = "Unlimited access with Premium";
    } else if (subscription.subscription_type === "free_trial") {
      message = `Free trial active - ${trialDaysRemaining} days remaining`;
    }

    const response: SubscriptionResponse = {
      canViewArticle,
      subscriptionType: subscription.subscription_type,
      remainingViews,
      dailyLimit: plan?.daily_article_limit || null,
      isTrialActive,
      trialDaysRemaining,
      message
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error) {
    console.error("Subscription check error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});