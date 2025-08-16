# Current Daily Articles Setup

## Active Implementation: Smart Daily Articles

The main `index.ts` is now using the **Smart Daily Articles implementation** that fetches ALL of today's articles.

### Key Features:

1. **Date-Based Filtering**

   - Fetches ONLY articles from today (UTC timezone)
   - Uses `created_at` field with `.gte()` and `.lte()` queries
   - Date range: 00:00:00 UTC to 23:59:59 UTC

2. **No Article Limits**

   - Returns ALL quality articles from today
   - Adapts to news volume dynamically
   - No arbitrary 10-article restriction

3. **Smart Filtering**

   - Uses `getSmartDailyArticles` and `getSmartDailyArticlesNoFilter`
   - Intelligent duplicate detection (default threshold: 0.85)
   - Provider diversity enforcement (max 2 consecutive from same source)
   - Higher priority providers win when duplicates detected

4. **Response Structure**
   ```json
   {
     "date": "2024-01-15",
     "total_fetched": 45,
     "providers_included": ["Telegrafi", "Insajderi", ...],
     "filtering_applied": true,
     "similarity_threshold": 0.85,
     "total_after_filtering": 28,
     "data": [...] // All quality articles from today
   }
   ```

### Performance:

- Single database query for today's articles
- Processing time scales with article count
- Typical response: 40-80ms
- 5-minute cache headers for efficiency

## File Structure:

- **`index.ts`** (ACTIVE) - Smart implementation (all today's articles)
- **`index-smart.ts`** - Original smart implementation file
- **`index-original.ts`** - Previous V2 optimized version (10 articles)
- **`index-optimized.ts`** - V2 optimized version (10 articles)
- **`services/smart-filter.ts`** - Smart filtering algorithms

## Why Smart Implementation?

- **True Daily Digest**: Shows actual news activity for the day
- **No Missing Stories**: Important news isn't cut off at 10
- **Adaptive**: Busy news days show more content
- **Quality Focused**: Still filters duplicates intelligently

## Deployment:

When you deploy, Supabase will use `index.ts` which now contains the smart implementation that:

- Fetches all articles from today
- Applies intelligent filtering
- Returns variable article counts
- Provides comprehensive daily coverage

## Query Parameters:

- `providers` - Comma-separated list of providers to include
- `similarity_threshold` - 0.5 to 0.95, or "none" to disable filtering
- `limit` - Optional: Maximum number of articles to return (e.g., 10)

## Example Usage:

```bash
# Get all today's articles with default filtering
curl https://your-project.supabase.co/functions/v1/daily-articles

# Get today's articles from specific providers
curl https://your-project.supabase.co/functions/v1/daily-articles?providers=Telegrafi,Insajderi

# Get all today's articles without duplicate filtering
curl https://your-project.supabase.co/functions/v1/daily-articles?similarity_threshold=none

# Get only 10 articles with smart filtering
curl https://your-project.supabase.co/functions/v1/daily-articles?limit=10

# Get 5 articles from specific providers
curl https://your-project.supabase.co/functions/v1/daily-articles?providers=Telegrafi,Insajderi&limit=5
```
