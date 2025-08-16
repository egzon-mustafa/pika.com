// Test script to demonstrate the smart daily articles functionality
import { getSmartDailyArticles, getSmartDailyArticlesNoFilter } from "./services/smart-filter.ts";
import { Article } from "./types/index.ts";

// Sample articles from today with various providers and some duplicates
const sampleTodayArticles: Article[] = [
  // Telegrafi articles
  {
    title: "Qeveria aprovon buxhetin për vitin 2024",
    url: "https://telegrafi.com/article1",
    publication_source: "Telegrafi",
    created_at: new Date().toISOString()
  },
  {
    title: "Protesta e studentëve në Prishtinë",
    url: "https://telegrafi.com/article2",
    publication_source: "Telegrafi",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
  },
  
  // Insajderi articles
  {
    title: "Qeveria miraton buxhetin për 2024", // Similar to Telegrafi
    url: "https://insajderi.com/article1",
    publication_source: "Insajderi",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 min ago
  },
  {
    title: "Ndryshimet klimatike në Kosovë",
    url: "https://insajderi.com/article2",
    publication_source: "Insajderi",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString() // 45 min ago
  },
  
  // Indeksonline articles
  {
    title: "Studentët protestojnë në Prishtinë", // Similar to Telegrafi
    url: "https://indeksonline.net/article1",
    publication_source: "indeksonline",
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString() // 20 min ago
  },
  {
    title: "Rritja ekonomike në Kosovë",
    url: "https://indeksonline.net/article2",
    publication_source: "indeksonline",
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() // 1 hour ago
  },
  
  // gazeta-express articles
  {
    title: "Buxheti 2024 i aprovuar nga qeveria", // Similar
    url: "https://gazeta-express.com/article1",
    publication_source: "gazeta-express",
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() // 10 min ago
  },
  {
    title: "Festivali i filmit në Prishtinë",
    url: "https://gazeta-express.com/article2",
    publication_source: "gazeta-express",
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() // 1.5 hours ago
  },
  
  // Additional unique articles
  {
    title: "Hapja e autostradës së re",
    url: "https://telegrafi.com/article3",
    publication_source: "Telegrafi",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
  },
  {
    title: "Teknologjia dhe inovacioni në Kosovë",
    url: "https://insajderi.com/article3",
    publication_source: "Insajderi",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString() // 3 hours ago
  }
];

console.log("=== Smart Daily Articles Test ===\n");
console.log(`Total articles from today: ${sampleTodayArticles.length}`);

// Test with similarity filtering
console.log("\n--- With Similarity Filtering (threshold: 0.85) ---");
const filteredArticles = getSmartDailyArticles(sampleTodayArticles, 0.85);
console.log(`Articles after filtering: ${filteredArticles.length}`);
console.log("\nFiltered articles:");
filteredArticles.forEach((article, index) => {
  console.log(`${index + 1}. [${article.publication_source}] ${article.title}`);
});

// Test without filtering
console.log("\n--- Without Filtering ---");
const unfilteredArticles = getSmartDailyArticlesNoFilter(sampleTodayArticles);
console.log(`All articles (smartly ordered): ${unfilteredArticles.length}`);
console.log("\nAll articles:");
unfilteredArticles.forEach((article, index) => {
  console.log(`${index + 1}. [${article.publication_source}] ${article.title}`);
});

// Show expected behavior
console.log("\n=== Expected Behavior ===");
console.log("1. With filtering: Duplicates removed, keeping highest priority provider");
console.log("2. Articles ordered by provider priority and recency");
console.log("3. Provider diversity enforced (no more than 2 consecutive from same source)");
console.log("4. All today's quality content returned (no 10-article limit)");
console.log("5. Adapts to news volume - more articles on busy news days");