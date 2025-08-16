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

// Enhanced version that guarantees 10 articles when possible
export function getOptimizedDailyArticlesV2(
  articles: Article[], 
  similarityThreshold: number = 0.85,
  targetCount: number = 10
): Article[] {
  if (articles.length === 0) return [];
  
  // If we have less than target, return all
  if (articles.length <= targetCount) return articles;
  
  const minPerProvider = 1;
  const result: Article[] = [];
  const selectedTitles: string[] = [];
  const providerCounts: Record<string, number> = {};
  
  // Group articles by provider
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
  
  // Initialize counts
  for (const provider of PROVIDER_ORDER) {
    providerCounts[provider] = 0;
  }
  
  // Phase 1: Try to get 1 article per provider with duplicate checking
  for (const provider of PROVIDER_ORDER) {
    const providerArticles = providerGroups[provider];
    if (!providerArticles || providerArticles.length === 0) continue;
    
    // Find first non-duplicate article from this provider
    for (const article of providerArticles) {
      const normalizedTitle = article.title.toLowerCase().trim();
      
      if (!isDuplicateTitle(normalizedTitle, selectedTitles, similarityThreshold)) {
        result.push(article);
        selectedTitles.push(normalizedTitle);
        providerCounts[provider] = 1;
        break;
      }
    }
  }
  
  // Phase 2: Fill remaining slots with priority-based distribution
  let remainingSlots = targetCount - result.length;
  
  if (remainingSlots > 0) {
    // Dynamic max allocation based on available slots
    const activeProviders = Object.keys(providerGroups).filter(p => providerGroups[p].length > 0);
    const avgPerProvider = Math.ceil(remainingSlots / Math.max(1, activeProviders.length));
    
    const maxAdditional: Record<string, number> = {
      'Telegrafi': Math.max(2, avgPerProvider), // Higher priority gets more
      'Insajderi': Math.max(1, avgPerProvider - 1),
      'indeksonline': Math.max(1, Math.min(avgPerProvider - 1, 2)),
      'gazeta-express': Math.max(1, Math.min(avgPerProvider - 1, 2)),
      'botasot': Math.max(1, Math.min(avgPerProvider - 1, 2)),
      'gazeta-blic': Math.max(1, Math.min(avgPerProvider - 1, 2))
    };
    
    // Try to fill with duplicate checking
    for (const provider of PROVIDER_ORDER) {
      if (remainingSlots <= 0) break;
      
      const providerArticles = providerGroups[provider];
      if (!providerArticles) continue;
      
      const currentCount = providerCounts[provider];
      const maxForProvider = minPerProvider + (maxAdditional[provider] || 1);
      const availableArticles = providerArticles.length - currentCount;
      
      if (availableArticles > 0) {
        let addedFromProvider = 0;
        const maxToAdd = Math.min(maxForProvider - currentCount, availableArticles, remainingSlots);
        
        for (let i = currentCount; i < providerArticles.length && addedFromProvider < maxToAdd; i++) {
          const article = providerArticles[i];
          const normalizedTitle = article.title.toLowerCase().trim();
          
          if (!isDuplicateTitle(normalizedTitle, selectedTitles, similarityThreshold)) {
            result.push(article);
            selectedTitles.push(normalizedTitle);
            providerCounts[provider]++;
            remainingSlots--;
            addedFromProvider++;
          }
        }
      }
    }
  }
  
  // Phase 3: If still not enough articles due to duplicates, relax the criteria
  if (result.length < targetCount) {
    console.log(`Only ${result.length} articles after duplicate filtering, adding more with relaxed criteria`);
    
    // Collect all unused articles
    const usedUrls = new Set(result.map(a => a.url));
    const unusedArticles: Article[] = [];
    
    for (const provider of PROVIDER_ORDER) {
      const providerArticles = providerGroups[provider] || [];
      for (const article of providerArticles) {
        if (!usedUrls.has(article.url)) {
          unusedArticles.push(article);
        }
      }
    }
    
    // Sort unused by date and add until we reach target
    unusedArticles.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    for (const article of unusedArticles) {
      if (result.length >= targetCount) break;
      
      // Use a more relaxed similarity check or skip entirely for the last slots
      const normalizedTitle = article.title.toLowerCase().trim();
      const relaxedThreshold = result.length >= targetCount - 2 ? 0.95 : similarityThreshold + 0.05;
      
      if (!isDuplicateTitle(normalizedTitle, selectedTitles, relaxedThreshold)) {
        result.push(article);
        selectedTitles.push(normalizedTitle);
      }
    }
  }
  
  // Final safety: If still not enough, just add any remaining articles
  if (result.length < targetCount) {
    const usedUrls = new Set(result.map(a => a.url));
    for (const article of articles) {
      if (result.length >= targetCount) break;
      if (!usedUrls.has(article.url)) {
        result.push(article);
      }
    }
  }
  
  return result.slice(0, targetCount);
}

// Optimized duplicate check
function isDuplicateTitle(
  title: string, 
  selectedTitles: string[], 
  threshold: number
): boolean {
  if (threshold === null || threshold === 0) return false;
  
  for (const existingTitle of selectedTitles) {
    const lengthDiff = Math.abs(title.length - existingTitle.length);
    const avgLength = (title.length + existingTitle.length) / 2;
    
    // Skip if length difference is > 50%
    if (lengthDiff > avgLength * 0.5) continue;
    
    if (distance(title, existingTitle) >= threshold) {
      return true;
    }
  }
  
  return false;
}

// Enhanced no-filter version that guarantees count
export function getOptimizedDailyArticlesNoFilterV2(
  articles: Article[],
  targetCount: number = 10
): Article[] {
  if (articles.length <= targetCount) return articles;
  
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
  
  // Sort each group by date
  for (const provider in providerGroups) {
    providerGroups[provider].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
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
  
  // Phase 2: Fill remaining with priority distribution
  const remaining = targetCount - result.length;
  if (remaining > 0) {
    let added = 0;
    
    // Calculate dynamic limits based on what we need
    const activeProviders = PROVIDER_ORDER.filter(p => providerGroups[p]?.length > 1);
    const baseAllocation = Math.floor(remaining / Math.max(1, activeProviders.length));
    
    for (const provider of PROVIDER_ORDER) {
      if (added >= remaining) break;
      
      const articles = providerGroups[provider] || [];
      const current = providerCounts[provider];
      
      // Dynamic max based on priority and need
      let maxForProvider = 2;
      if (provider === 'Telegrafi') maxForProvider = Math.max(3, baseAllocation + 1);
      else if (provider === 'Insajderi') maxForProvider = Math.max(2, baseAllocation);
      
      const available = articles.length - current;
      const canAdd = Math.min(maxForProvider - current, available, remaining - added);
      
      if (canAdd > 0) {
        for (let i = 0; i < canAdd; i++) {
          result.push(articles[current + i]);
          added++;
        }
        providerCounts[provider] += canAdd;
      }
    }
    
    // Phase 3: If still need more, add from any provider
    if (added < remaining) {
      const allSorted = articles.filter(a => !result.includes(a))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      const stillNeeded = remaining - added;
      result.push(...allSorted.slice(0, stillNeeded));
    }
  }
  
  return result.slice(0, targetCount);
}