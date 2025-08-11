// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js";
import { load as loadHtmlToCheerio } from "cheerio";

interface Article {
  title: string;
  url: string;
  imageUrl: string | null;
  publicationDate: string;
}

const trendUrl: string = "https://telegrafi.com/ne-trend/";

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

async function saveToSupabase(
  supabase: ReturnType<typeof createClient>,
  data: Article,
): Promise<boolean> {
  if (!data) return false;

  const { data: existingArticle, error: selectError } = await supabase
    .from("articles")
    .select("url")
    .eq("url", data.url)
    .maybeSingle();

  if (selectError) {
    console.error("Error checking for existing article:", selectError);
    return false;
  }

  if (existingArticle) {
    console.log(` -> Article with URL already exists: ${data.url}`);
    return false;
  }

  const { error: insertError } = await supabase.from("articles").insert([
    {
      title: data.title,
      url: data.url,
      image_url: data.imageUrl,
      publication_date: data.publicationDate,
      publication_source: "telegrafi",
    },
  ]);

  if (insertError) {
    console.error(`Error saving article to Supabase:`, insertError);
    return false;
  } else {
    console.log(` -> Saved article to Supabase: ${data.title}`);
    return true;
  }
}

async function fetchArticles() {
  const supabase = getSupabaseClient();
  let articlesSaved = 0;
  const existingArticles = new Set<string>();

  // Load existing article URLs
  const { data, error } = await supabase.from("articles").select("url");
  if (error) {
    console.error("Error loading existing articles:", error);
  } else if (data) {
    for (const article of data) {
      if (article?.url) existingArticles.add(article.url);
    }
    console.log(
      `Loaded ${existingArticles.size} existing articles from Supabase.`,
    );
  }

  const urlsToScrape: string[] = [trendUrl];
  for (let i = 2; i <= 4; i++) {
    urlsToScrape.push(`${trendUrl}page/${i}/`);
  }

  console.log(`Fetching articles from ${urlsToScrape.length} pages...`);

  for (const pageUrl of urlsToScrape) {
    try {
      console.log(`Scraping page: ${pageUrl}`);
      const response = await fetch(pageUrl, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
      });
      if (!response.ok) {
        console.error(`Failed to fetch ${pageUrl}: ${response.status}`);
        continue;
      }
      const html = await response.text();
      const $ = loadHtmlToCheerio(html);

      const articleElements = $("a.post__large--row").toArray();

      for (const element of articleElements) {
        const el = $(element);
        const articleUrl = el.attr("href")?.trim();
        const title = el.find("img").attr("alt")?.trim();
        const imageUrl = el.find("img").attr("src")?.trim() ?? null;
        const publicationDate = el.find(".post_date_info").text().trim();

        if (!articleUrl || !title || !publicationDate) continue;
        if (existingArticles.has(articleUrl)) continue;

        const articleData: Article = {
          title,
          url: articleUrl,
          image_url: imageUrl,
          publication_date: publicationDate,
          publication_source: "telegrafi",
        };

        if (await saveToSupabase(supabase, articleData)) {
          articlesSaved++;
        }
        existingArticles.add(articleUrl);
      }
    } catch (err) {
      console.error(`Error scraping page ${pageUrl}:`, err);
    }
  }

  return { articlesSaved };
}

Deno.serve(async (_req) => {
  try {
    const result = await fetchArticles();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler' \
    --header 'Authorization: Bearer <your_anon_jwt>' \
    --header 'Content-Type: application/json'

*/
