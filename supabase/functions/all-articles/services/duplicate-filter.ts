import distance from "jaro-winkler";
import { Article } from "../types/index.ts";

// Provider priority ranking (higher number = higher priority)
const PROVIDER_RANKINGS: Record<string, number> = {
  'telegrafi': 5,
  'gazeta-express': 4,
  'insajderi': 3,
  'gazeta-blic': 2,
  'default': 1
} as const;

// Cache for provider scores to avoid repeated lookups
const providerScoreCache = new Map<string, number>();

// Get provider priority score with caching
function getProviderScore(provider: string): number {
  if (providerScoreCache.has(provider)) {
    return providerScoreCache.get(provider)!;
  }
  
  const score = PROVIDER_RANKINGS[provider] || PROVIDER_RANKINGS['default'];
  providerScoreCache.set(provider, score);
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

// Cache management for memory optimization
export function clearCaches(): void {
  providerScoreCache.clear();
  dateCache.clear();
  titleCache.clear();
}

// Export provider rankings for reference
export { PROVIDER_RANKINGS };

// Optimized filtering statistics with better performance
export function getFilteringStats(originalArticles: Article[], filteredArticles: Article[]): {
  totalOriginal: number;
  totalFiltered: number;
  duplicatesRemoved: number;
  providerBreakdown: Record<string, number>;
  performance: {
    reductionPercentage: number;
    averageArticlesPerProvider: number;
  };
} {
  const providerBreakdown: Record<string, number> = {};
  
  // Use for...of for better performance than forEach
  for (const article of filteredArticles) {
    const provider = article.publication_source;
    providerBreakdown[provider] = (providerBreakdown[provider] || 0) + 1;
  }
  
  const duplicatesRemoved = originalArticles.length - filteredArticles.length;
  const reductionPercentage = originalArticles.length > 0 
    ? (duplicatesRemoved / originalArticles.length) * 100 
    : 0;
  
  const providerCount = Object.keys(providerBreakdown).length;
  const averageArticlesPerProvider = providerCount > 0 
    ? filteredArticles.length / providerCount 
    : 0;
  
  return {
    totalOriginal: originalArticles.length,
    totalFiltered: filteredArticles.length,
    duplicatesRemoved,
    providerBreakdown,
    performance: {
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      averageArticlesPerProvider: Math.round(averageArticlesPerProvider * 100) / 100
    }
  };
}

