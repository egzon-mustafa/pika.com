# Smart Daily Articles Upgrade

## Overview

The Smart Daily Articles endpoint represents a fundamental shift in how we handle daily news aggregation. Instead of arbitrarily limiting to 10 articles, it provides all quality content from today.

## Key Changes

### 1. **Date-Based Filtering**

**Before**: Fetched most recent articles regardless of date
**After**: Fetches only articles from today (00:00:00 - 23:59:59 UTC)

```typescript
// New date range filtering
.gte("created_at", startOfToday)
.lte("created_at", endOfToday)
```

### 2. **No Arbitrary Limits**

**Before**: Always returned exactly 10 articles
**After**: Returns all quality articles from today

### 3. **Smarter Duplicate Handling**

**Before**: First-come-first-served duplicate filtering
**After**: Keeps article from highest priority provider when duplicates found

### 4. **Enhanced Provider Diversity**

**Before**: Fixed distribution (1-3 articles per provider)
**After**: Dynamic distribution with diversity enforcement

## Benefits

1. **Adaptive Content Volume**

   - Busy news days: More articles
   - Quiet days: Fewer articles
   - Always relevant, never forced

2. **Complete Coverage**

   - No important stories missed due to limit
   - All quality content from the day

3. **Better User Experience**
   - True daily digest
   - Reflects actual news activity
   - More value on important news days

## API Changes

### Response Structure

```typescript
{
  date: "2024-01-15",              // Added: Current date
  total_fetched: 45,               // All today's articles
  providers_included: [...],
  filtering_applied: true,
  similarity_threshold: 0.85,
  total_after_filtering: 28,       // Variable count
  data: [...]                      // All quality articles
}
```

### Query Parameters

- `providers`: Same (comma-separated list)
- `similarity_threshold`: Same (0.5-0.95 or "none")

## Migration Guide

### To use the smart version:

1. **In production**: Deploy `index-smart.ts` as your edge function
2. **For testing**: Use the same endpoint, expect variable article counts
3. **Frontend adjustments**: Remove any hardcoded "10 articles" assumptions

### Rollback option:

The previous implementations are preserved:

- `index.ts` - Original implementation
- `index-optimized.ts` - V2 optimized (guaranteed 10)
- `index-smart.ts` - Smart implementation (all today's articles)

## Performance Considerations

- **Database query**: Single query for today's articles
- **Processing**: O(n) where n = today's article count
- **Typical response time**: 40-80ms depending on article volume
- **Caching**: 5-minute cache (vs 1-minute) due to date-based nature

## Example Usage

```bash
# Get all today's quality articles
curl https://your-project.supabase.co/functions/v1/daily-articles

# Get today's articles from specific providers
curl https://your-project.supabase.co/functions/v1/daily-articles?providers=Telegrafi,Insajderi

# Get all today's articles without duplicate filtering
curl https://your-project.supabase.co/functions/v1/daily-articles?similarity_threshold=none
```

## Future Enhancements

1. **Time-based filtering**: Allow fetching last X hours
2. **Category filtering**: Filter by news category
3. **Importance scoring**: ML-based article importance ranking
4. **Personalization**: User preference-based ordering
