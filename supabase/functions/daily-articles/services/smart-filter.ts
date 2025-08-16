import distance from "jaro-winkler";
import { Article } from "../types/index.ts";

// Provider priority ranking (higher number = higher priority)
const PROVIDER_RANKINGS: Record<string, number> = {
  'Telegrafi': 6,
  'Insajderi': 5,
  'indeksonline': 4,
  'gazeta-express': 3,
  'botasot': 2,
  'gazeta-blic': 1,
  'default': 6
} as const;

const PROVIDER_ORDER = ['Telegrafi', 'Insajderi', 'indeksonline', 'gazeta-express', 'botasot', 'gazeta-blic'] as const;

// Smart filtering that returns all quality articles from today
export function getSmartDailyArticles(
  articles: Article[], 
  similarityThreshold: number = 0.85,
  limit: number | null = null
): Article[] {
  if (articles.length === 0) return [];
  
  // Group articles by provider
  const providerGroups: Record<string, Article[]> = {};
  for (const article of articles) {
    const provider = article.publication_source;
    if (!providerGroups[provider]) {
      providerGroups[provider] = [];
    }
    providerGroups[provider].push(article);
  }
  
  // Sort each provider's articles by date (newest first)
  for (const provider in providerGroups) {
    providerGroups[provider].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  
  const result: Article[] = [];
  const selectedTitles: string[] = [];
  const titleToArticle = new Map<string, Article>();
  
  // Process all articles with duplicate filtering
  // Go through providers in priority order
  for (const provider of PROVIDER_ORDER) {
    const providerArticles = providerGroups[provider];
    if (!providerArticles || providerArticles.length === 0) continue;
    
    // Process all articles from this provider
    for (const article of providerArticles) {
      const normalizedTitle = article.title.toLowerCase().trim();
      
      // Check for duplicates
      let isDuplicate = false;
      let duplicateOf: string | null = null;
      
      for (const existingTitle of selectedTitles) {
        if (isSimilarTitle(normalizedTitle, existingTitle, similarityThreshold)) {
          isDuplicate = true;
          duplicateOf = existingTitle;
          break;
        }
      }
      
      if (!isDuplicate) {
        // New unique article
        result.push(article);
        selectedTitles.push(normalizedTitle);
        titleToArticle.set(normalizedTitle, article);
      } else if (duplicateOf) {
        // This is a duplicate - keep the one from higher priority provider
        const existingArticle = titleToArticle.get(duplicateOf);
        if (existingArticle) {
          const currentPriority = PROVIDER_RANKINGS[provider] || 0;
          const existingPriority = PROVIDER_RANKINGS[existingArticle.publication_source] || 0;
          
          // Replace if current provider has higher priority
          if (currentPriority > existingPriority) {
            const existingIndex = result.findIndex(a => a.url === existingArticle.url);
            if (existingIndex !== -1) {
              result[existingIndex] = article;
              titleToArticle.set(duplicateOf, article);
            }
          }
        }
      }
    }
  }
  
  // Sort final results by a combination of priority and recency
  result.sort((a, b) => {
    // First sort by provider priority
    const priorityA = PROVIDER_RANKINGS[a.publication_source] || 0;
    const priorityB = PROVIDER_RANKINGS[b.publication_source] || 0;
    
    // If same priority, sort by date
    if (priorityA === priorityB) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    
    // Otherwise, higher priority first
    return priorityB - priorityA;
  });
  
  // Add some diversity - ensure not too many from same provider in a row
  const diversified = diversifyArticles(result);
  
  // Apply limit if specified
  if (limit && limit > 0) {
    return diversified.slice(0, limit);
  }
  
  return diversified;
}

// Check if two titles are similar
function isSimilarTitle(
  title1: string, 
  title2: string, 
  threshold: number
): boolean {
  if (threshold === null || threshold === 0) return false;
  
  // Quick length check
  const lengthDiff = Math.abs(title1.length - title2.length);
  const avgLength = (title1.length + title2.length) / 2;
  
  // Skip if length difference is > 50%
  if (lengthDiff > avgLength * 0.5) return false;
  
  // Check similarity
  return distance(title1, title2) >= threshold;
}

// Ensure provider diversity in the article order
function diversifyArticles(articles: Article[]): Article[] {
  if (articles.length <= 3) return articles;
  
  const result: Article[] = [];
  const remaining = [...articles];
  const lastProviders: string[] = [];
  const maxConsecutive = 2;
  
  while (remaining.length > 0) {
    // Find best article considering diversity
    let selectedIndex = 0;
    
    // Check if we need to enforce diversity
    if (lastProviders.length >= maxConsecutive) {
      const lastProvider = lastProviders[lastProviders.length - 1];
      const secondLastProvider = lastProviders[lastProviders.length - 2];
      
      // If last two are from same provider, try to pick different one
      if (lastProvider === secondLastProvider) {
        for (let i = 0; i < remaining.length; i++) {
          if (remaining[i].publication_source !== lastProvider) {
            selectedIndex = i;
            break;
          }
        }
      }
    }
    
    // Add selected article
    const selected = remaining.splice(selectedIndex, 1)[0];
    result.push(selected);
    
    // Update provider history
    lastProviders.push(selected.publication_source);
    if (lastProviders.length > maxConsecutive) {
      lastProviders.shift();
    }
  }
  
  return result;
}

// Version without duplicate filtering - returns all today's articles with smart ordering
export function getSmartDailyArticlesNoFilter(articles: Article[], limit: number | null = null): Article[] {
  if (articles.length === 0) return [];
  
  // Group by provider
  const providerGroups: Record<string, Article[]> = {};
  for (const article of articles) {
    const provider = article.publication_source;
    if (!providerGroups[provider]) {
      providerGroups[provider] = [];
    }
    providerGroups[provider].push(article);
  }
  
  // Sort each provider's articles by date
  for (const provider in providerGroups) {
    providerGroups[provider].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  
  // Interleave articles from different providers for diversity
  const result: Article[] = [];
  let hasMore = true;
  let index = 0;
  
  // Round-robin through providers
  while (hasMore) {
    hasMore = false;
    
    for (const provider of PROVIDER_ORDER) {
      const articles = providerGroups[provider];
      if (articles && index < articles.length) {
        result.push(articles[index]);
        hasMore = true;
      }
    }
    
    index++;
  }
  
  // Apply limit if specified
  if (limit && limit > 0) {
    return result.slice(0, limit);
  }
  
  return result;
}

/* Smart Daily Articles Logic:
 * 
 * 1. FLEXIBLE LIMITS: Returns all articles by default, respects limit parameter if provided
 * 2. DUPLICATE HANDLING: Keeps article from highest priority provider
 * 3. SMART ORDERING: Balances provider priority with recency
 * 4. DIVERSITY: Prevents too many consecutive articles from same provider
 * 5. QUALITY FIRST: Focuses on delivering important news with smart filtering
 * 
 * Result: A comprehensive daily digest that adapts to news volume and user preferences
 */