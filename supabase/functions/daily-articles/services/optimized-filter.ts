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

// Optimized version that combines all operations in a single pass
export function getOptimizedDailyArticles(
  articles: Article[], 
  similarityThreshold: number = 0.85
): Article[] {
  const targetCount = 10;
  const minPerProvider = 1;
  
  // Group articles by provider in a single pass
  const providerGroups: Record<string, Article[]> = {};
  const titleNormCache = new Map<string, string>();
  
  // Single pass to group articles
  for (const article of articles) {
    const provider = article.publication_source;
    if (!providerGroups[provider]) {
      providerGroups[provider] = [];
    }
    providerGroups[provider].push(article);
  }
  
  // Sort each provider's articles by date once
  for (const provider of PROVIDER_ORDER) {
    if (providerGroups[provider]) {
      providerGroups[provider].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
  }
  
  const result: Article[] = [];
  const selectedTitles: string[] = [];
  const providerCounts: Record<string, number> = {};
  
  // Initialize counts
  for (const provider of PROVIDER_ORDER) {
    providerCounts[provider] = 0;
  }
  
  // Optimized distribution with duplicate check
  // Phase 1: Mandatory 1 per provider with duplicate filtering
  for (const provider of PROVIDER_ORDER) {
    const providerArticles = providerGroups[provider];
    if (!providerArticles || providerArticles.length === 0) continue;
    
    // Find first non-duplicate article from this provider
    for (const article of providerArticles) {
      const normalizedTitle = article.title.toLowerCase().trim();
      
      // Quick duplicate check
      if (!isDuplicateTitle(normalizedTitle, selectedTitles, similarityThreshold)) {
        result.push(article);
        selectedTitles.push(normalizedTitle);
        providerCounts[provider] = 1;
        break;
      }
    }
  }
  
  // Phase 2: Fill remaining slots with priority
  const remainingSlots = targetCount - result.length;
  if (remainingSlots > 0) {
    // Calculate max articles per provider for remaining slots
    const maxAdditional: Record<string, number> = {
      'Telegrafi': 2, // Can have up to 3 total
      'Insajderi': 1, // Can have up to 2 total
      'indeksonline': 1,
      'gazeta-express': 1,
      'botasot': 1,
      'gazeta-blic': 1
    };
    
    // Fill remaining slots
    let slotsToFill = remainingSlots;
    for (const provider of PROVIDER_ORDER) {
      if (slotsToFill <= 0) break;
      
      const providerArticles = providerGroups[provider];
      if (!providerArticles) continue;
      
      const currentCount = providerCounts[provider];
      const maxForProvider = minPerProvider + (maxAdditional[provider] || 1);
      const canAddMore = Math.min(
        maxForProvider - currentCount,
        providerArticles.length - currentCount,
        slotsToFill
      );
      
      if (canAddMore > 0) {
        // Add articles starting from where we left off
        for (let i = currentCount; i < currentCount + canAddMore; i++) {
          const article = providerArticles[i];
          const normalizedTitle = article.title.toLowerCase().trim();
          
          if (!isDuplicateTitle(normalizedTitle, selectedTitles, similarityThreshold)) {
            result.push(article);
            selectedTitles.push(normalizedTitle);
            providerCounts[provider]++;
            slotsToFill--;
          }
        }
      }
    }
  }
  
  return result.slice(0, targetCount);
}

// Optimized duplicate check - only check against selected articles
function isDuplicateTitle(
  title: string, 
  selectedTitles: string[], 
  threshold: number
): boolean {
  if (threshold === null || threshold === 0) return false;
  
  // Early exit if title lengths are very different
  for (const existingTitle of selectedTitles) {
    const lengthDiff = Math.abs(title.length - existingTitle.length);
    const avgLength = (title.length + existingTitle.length) / 2;
    
    // Skip if length difference is > 50%
    if (lengthDiff > avgLength * 0.5) continue;
    
    // Check similarity
    if (distance(title, existingTitle) >= threshold) {
      return true;
    }
  }
  
  return false;
}

// Lightweight version without any duplicate filtering for maximum speed
export function getOptimizedDailyArticlesNoFilter(articles: Article[]): Article[] {
  const targetCount = 10;
  const result: Article[] = [];
  const providerCounts: Record<string, number> = {};
  
  // Group by provider
  const providerGroups: Record<string, Article[]> = {};
  for (const article of articles) {
    const provider = article.publication_source;
    if (!providerGroups[provider]) {
      providerGroups[provider] = [];
    }
    providerGroups[provider].push(article);
  }
  
  // Phase 1: 1 per provider
  for (const provider of PROVIDER_ORDER) {
    if (providerGroups[provider]?.length > 0) {
      result.push(providerGroups[provider][0]);
      providerCounts[provider] = 1;
    } else {
      providerCounts[provider] = 0;
    }
  }
  
  // Phase 2: Fill remaining
  const remaining = targetCount - result.length;
  if (remaining > 0) {
    let added = 0;
    
    // Priority-based filling
    for (const provider of PROVIDER_ORDER) {
      if (added >= remaining) break;
      
      const maxForProvider = provider === 'Telegrafi' ? 3 : 2;
      const current = providerCounts[provider];
      const available = (providerGroups[provider]?.length || 0) - current;
      const canAdd = Math.min(maxForProvider - current, available, remaining - added);
      
      if (canAdd > 0) {
        for (let i = 0; i < canAdd; i++) {
          result.push(providerGroups[provider][current + i]);
          added++;
        }
        providerCounts[provider] += canAdd;
      }
    }
  }
  
  return result.slice(0, targetCount);
}