import distance from "jaro-winkler";
import { Article } from "../types/index.ts";

// Provider priority ranking (higher number = higher priority)
// Based on priority: 1. Telegrafi, 2. Insajderi, 3. IndeksOnline, 4. Gazeta Express, 5. BotaSot, 6. Gazeta Blic
const PROVIDER_RANKINGS: Record<string, number> = {
  // Exact database name matching
  'Telegrafi': 6,           // 1st priority
  'Insajderi': 5,           // 2nd priority
  'indeksonline': 4,        // 3rd priority
  'gazeta-express': 3,      // 4th priority
  'botasot': 2,             // 5th priority
  'gazeta-blic': 1,         // 6th priority
  'default': 6              // Default to highest priority (same as Telegrafi)
} as const;

// Cache for provider scores to avoid repeated lookups
const providerScoreCache = new Map<string, number>();

// Get provider priority score with caching
function getProviderScore(provider: string): number {
  if (providerScoreCache.has(provider)) {
    return providerScoreCache.get(provider)!;
  }
  
  // Try exact match first, then normalized version
  let score = PROVIDER_RANKINGS[provider];
  if (score === undefined) {
    const normalizedProvider = provider.toLowerCase();
    score = PROVIDER_RANKINGS[normalizedProvider] || PROVIDER_RANKINGS['default'];
  }
  
  providerScoreCache.set(provider, score);
  
  // Debug logging to see what providers we're getting
  console.log(`Provider: "${provider}" -> Score: ${score}`);
  
  return score;
}

// Cache for date parsing to avoid repeated Date() calls
const dateCache = new Map<string, number>();

// Get date timestamp with caching
function getDateTimestamp(dateString: string): number {
  if (dateCache.has(dateString)) {
    return dateCache.get(dateString)!;
  }
  
  const timestamp = new Date(dateString).getTime();
  dateCache.set(dateString, timestamp);
  return timestamp;
}

// Determine which article to keep when duplicates are found
function selectBetterArticle(current: Article, existing: Article): Article {
  const currentScore = getProviderScore(current.publication_source);
  const existingScore = getProviderScore(existing.publication_source);
  
  // 1. Prefer higher-ranked provider
  if (currentScore !== existingScore) {
    return currentScore > existingScore ? current : existing;
  }
  
  // 2. If same provider ranking, prefer more recent (optimized with caching)
  const currentTimestamp = getDateTimestamp(current.created_at);
  const existingTimestamp = getDateTimestamp(existing.created_at);
  return currentTimestamp > existingTimestamp ? current : existing;
}

// Cache for normalized titles to avoid repeated processing
const titleCache = new Map<string, string>();

// Normalize title with caching
function getNormalizedTitle(title: string): string {
  if (titleCache.has(title)) {
    return titleCache.get(title)!;
  }
  
  const normalized = title.toLowerCase().trim();
  titleCache.set(title, normalized);
  return normalized;
}

// Early exit check for obvious non-duplicates
function isObviouslyDifferent(title1: string, title2: string): boolean {
  const lengthDiff = Math.abs(title1.length - title2.length);
  const avgLength = (title1.length + title2.length) / 2;
  
  // If length difference is more than 50% of average length, likely different
  return lengthDiff > avgLength * 0.5;
}

// Optimized duplicate filtering with multiple performance improvements
export function filterDuplicateArticles(articles: Article[], similarityThreshold: number = 0.85): Article[] {
  if (!articles || articles.length === 0) return [];
  if (articles.length === 1) return [...articles];
  
  // Input validation
  if (similarityThreshold < 0 || similarityThreshold > 1) {
    throw new Error('Similarity threshold must be between 0 and 1');
  }
  
  const uniqueArticles: Article[] = [];
  const processedTitles: string[] = [];
  
  for (const article of articles) {
    // Input validation
    if (!article.title || !article.publication_source || !article.created_at) {
      continue; // Skip invalid articles
    }
    
    let isDuplicate = false;
    const currentTitle = getNormalizedTitle(article.title);
    
    // Check against existing unique articles
    for (let i = 0; i < uniqueArticles.length; i++) {
      const existingTitle = processedTitles[i];
      
      // Early exit for obviously different titles
      if (isObviouslyDifferent(currentTitle, existingTitle)) {
        continue;
      }
      
      const similarity = distance(currentTitle, existingTitle);
      
      if (similarity >= similarityThreshold) {
        isDuplicate = true;
        const betterArticle = selectBetterArticle(article, uniqueArticles[i]);
        if (betterArticle === article) {
          // Replace existing with better article
          uniqueArticles[i] = article;
          processedTitles[i] = currentTitle;
        }
        break; // Found duplicate, no need to check further
      }
    }
    
    if (!isDuplicate) {
      uniqueArticles.push(article);
      processedTitles.push(currentTitle);
    }
  }
  
  return uniqueArticles;
}

// Sort articles by provider priority and then by creation date
export function sortArticlesByPriority(articles: Article[]): Article[] {
  return articles.sort((a, b) => {
    // First, sort by provider priority (higher priority first)
    const priorityA = getProviderScore(a.publication_source);
    const priorityB = getProviderScore(b.publication_source);
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }
    
    // If same priority, sort by creation date (newer first)
    const dateA = getDateTimestamp(a.created_at);
    const dateB = getDateTimestamp(b.created_at);
    return dateB - dateA; // Newer first
  });
}

// Get exactly 10 articles with ALL providers represented and priority-based distribution
export function getTenDailyArticles(articles: Article[]): Article[] {
  const targetCount = 10;
  const providerOrder = ['Telegrafi', 'Insajderi', 'indeksonline', 'gazeta-express', 'botasot', 'gazeta-blic'];
  
  // Group articles by provider
  const providerArticles: Record<string, Article[]> = {};
  for (const article of articles) {
    const provider = article.publication_source;
    if (!providerArticles[provider]) {
      providerArticles[provider] = [];
    }
    providerArticles[provider].push(article);
  }
  
  // Smart distribution algorithm ensuring ALL providers are represented
  const result: Article[] = [];
  const providerCounts: Record<string, number> = {};
  
  // Initialize counts
  for (const provider of providerOrder) {
    providerCounts[provider] = 0;
  }
  
  // MANDATORY: Give exactly 1 article to EACH provider (6 articles total)
  // This ensures all providers are represented
  for (const provider of providerOrder) {
    if (providerArticles[provider] && providerArticles[provider].length > 0) {
      result.push(providerArticles[provider][0]);
      providerCounts[provider] = 1;
    } else {
      // If a provider has no articles, log a warning but continue
      console.warn(`Provider ${provider} has no articles available`);
    }
  }
  
  console.log(`After mandatory distribution: ${result.length} articles, need ${targetCount - result.length} more`);
  
  // Second pass: Distribute remaining 4 slots based on priority
  // Higher priority providers get preference for additional articles
  while (result.length < targetCount) {
    let addedArticle = false;
    
    for (const provider of providerOrder) {
      if (result.length >= targetCount) break;
      
      const availableArticles = providerArticles[provider] || [];
      const currentCount = providerCounts[provider];
      
      // Can we add another article from this provider?
      if (availableArticles.length > currentCount) {
        // Priority-based additional distribution:
        // Telegrafi (highest priority): can have up to 3 total (2 additional)
        // Insajderi: can have up to 2 total (1 additional)
        // Others: can have up to 2 total (1 additional)
        let maxForProvider = 2;
        if (provider === 'Telegrafi') {
          maxForProvider = 3;
        }
        
        if (currentCount < maxForProvider) {
          result.push(availableArticles[currentCount]);
          providerCounts[provider]++;
          addedArticle = true;
          console.log(`Added additional article from ${provider} (count: ${providerCounts[provider]})`);
        }
      }
    }
    
    // If we couldn't add any more articles, break to avoid infinite loop
    if (!addedArticle) {
      console.warn(`Could not fill all ${targetCount} slots. Final count: ${result.length}`);
      break;
    }
  }
  
  // Log the final distribution for debugging
  console.log('Daily articles - FINAL distribution (all providers represented):', providerCounts);
  console.log(`Total articles: ${articles.length} -> ${result.length} (target: ${targetCount})`);
  
  // Verify all providers are represented
  const representedProviders = Object.keys(providerCounts).filter(p => providerCounts[p] > 0);
  console.log(`Providers represented: ${representedProviders.length}/6 - ${representedProviders.join(', ')}`);
  
  return result.slice(0, targetCount); // Ensure we never exceed 10
}

// Cache management for memory optimization
export function clearCaches(): void {
  providerScoreCache.clear();
  dateCache.clear();
  titleCache.clear();
}

// Export provider rankings for reference
export { PROVIDER_RANKINGS };