// Test script to demonstrate the limit parameter functionality
import { getSmartDailyArticles, getSmartDailyArticlesNoFilter } from "./services/smart-filter.ts";
import { Article } from "./types/index.ts";

// Sample articles from today
const sampleArticles: Article[] = [
  { title: "News 1", url: "url1", publication_source: "Telegrafi", created_at: new Date().toISOString() },
  { title: "News 2", url: "url2", publication_source: "Insajderi", created_at: new Date().toISOString() },
  { title: "News 3", url: "url3", publication_source: "indeksonline", created_at: new Date().toISOString() },
  { title: "News 4", url: "url4", publication_source: "Telegrafi", created_at: new Date().toISOString() },
  { title: "News 5", url: "url5", publication_source: "Insajderi", created_at: new Date().toISOString() },
  { title: "News 6", url: "url6", publication_source: "indeksonline", created_at: new Date().toISOString() },
  { title: "News 7", url: "url7", publication_source: "gazeta-express", created_at: new Date().toISOString() },
  { title: "News 8", url: "url8", publication_source: "botasot", created_at: new Date().toISOString() },
  { title: "News 9", url: "url9", publication_source: "gazeta-blic", created_at: new Date().toISOString() },
  { title: "News 10", url: "url10", publication_source: "Telegrafi", created_at: new Date().toISOString() },
  { title: "News 11", url: "url11", publication_source: "Insajderi", created_at: new Date().toISOString() },
  { title: "News 12", url: "url12", publication_source: "indeksonline", created_at: new Date().toISOString() },
  { title: "News 13", url: "url13", publication_source: "Telegrafi", created_at: new Date().toISOString() },
  { title: "News 14", url: "url14", publication_source: "Insajderi", created_at: new Date().toISOString() },
  { title: "News 15", url: "url15", publication_source: "gazeta-express", created_at: new Date().toISOString() },
];

console.log("=== Testing Limit Parameter ===\n");
console.log(`Total sample articles: ${sampleArticles.length}\n`);

// Test 1: No limit (returns all)
console.log("1. No limit specified:");
const allArticles = getSmartDailyArticles(sampleArticles, 0.85, null);
console.log(`   Returned: ${allArticles.length} articles\n`);

// Test 2: Limit to 10
console.log("2. Limit = 10:");
const tenArticles = getSmartDailyArticles(sampleArticles, 0.85, 10);
console.log(`   Returned: ${tenArticles.length} articles`);
console.log("   Articles:", tenArticles.map(a => `[${a.publication_source}] ${a.title}`).join(", "));
console.log();

// Test 3: Limit to 5
console.log("3. Limit = 5:");
const fiveArticles = getSmartDailyArticles(sampleArticles, 0.85, 5);
console.log(`   Returned: ${fiveArticles.length} articles`);
console.log("   Articles:", fiveArticles.map(a => `[${a.publication_source}] ${a.title}`).join(", "));
console.log();

// Test 4: No filtering with limit
console.log("4. No filtering, Limit = 7:");
const sevenUnfiltered = getSmartDailyArticlesNoFilter(sampleArticles, 7);
console.log(`   Returned: ${sevenUnfiltered.length} articles`);
console.log("   Articles:", sevenUnfiltered.map(a => `[${a.publication_source}] ${a.title}`).join(", "));

console.log("\n=== Key Points ===");
console.log("- Without limit: Returns all filtered articles");
console.log("- With limit: Returns up to the specified number");
console.log("- Smart filtering and diversity are applied BEFORE the limit");
console.log("- Ensures best quality articles are included within the limit");