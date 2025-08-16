# Daily Articles Function

This Supabase Edge Function provides a curated daily news overview by returning exactly **10 articles** with smart distribution across providers, ensuring balanced coverage while respecting provider priority ranking.

## Overview

The `daily-articles` function is designed to give users a perfect daily snapshot with exactly 10 articles. Unlike the `all-articles` function which can return many articles per provider, this function uses intelligent distribution to provide balanced coverage while respecting provider priorities.

## How it works

1. **Fetches Recent Articles**: Retrieves the 50 most recent articles from all providers
2. **Applies Duplicate Filtering**: Removes similar articles using Jaro-Winkler distance algorithm
3. **Sorts by Priority**: Orders articles by provider priority and recency
4. **Smart Distribution**: Distributes exactly 10 articles across providers using priority-based algorithm

## Provider Priority Order

The function uses smart distribution based on provider priority:

1. **Telegrafi** (highest priority) - **up to 3 articles**
2. **Insajderi** - **up to 2 articles**
3. **IndeksOnline** - **up to 2 articles**
4. **Gazeta Express** - **up to 2 articles**
5. **BotaSot** - **up to 2 articles**
6. **Gazeta Blic** (lowest priority) - **up to 2 articles**

## Distribution Algorithm

1. **MANDATORY Phase**: Each provider gets exactly 1 article (6 articles total)
   - Guarantees ALL providers are represented
   - Non-negotiable requirement for balanced coverage
2. **PRIORITY Phase**: Remaining 4 slots distributed by priority order
   - Telegrafi gets preference (can have up to 3 total)
   - Others can have up to 2 total
3. **Result**: Exactly 10 articles with ALL providers represented

## API Usage

### Basic Request

```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles' \
  --header 'Authorization: Bearer <your_anon_jwt>'
```

### With Specific Providers

```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?providers=Telegrafi,Insajderi' \
  --header 'Authorization: Bearer <your_anon_jwt>'
```

### With Custom Similarity Threshold

```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?similarity_threshold=0.8' \
  --header 'Authorization: Bearer <your_anon_jwt>'
```

### Disable Filtering

```bash
curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/daily-articles?similarity_threshold=none' \
  --header 'Authorization: Bearer <your_anon_jwt>'
```

## Query Parameters

- **`providers`**: Comma-separated list of specific providers to include
- **`similarity_threshold`**: Float between 0.5-0.95 for duplicate detection sensitivity, or "none" to disable

## Response Format

### Success Response

```json
{
  "total_fetched": 50,
  "providers_included": [
    "Telegrafi",
    "Insajderi",
    "indeksonline",
    "gazeta-express",
    "botasot",
    "gazeta-blic"
  ],
  "filtering_applied": true,
  "similarity_threshold": 0.85,
  "total_after_filtering": 10,
  "data": [
    {
      "title": "Article from Telegrafi",
      "url": "https://telegrafi.com/...",
      "publication_source": "Telegrafi",
      "created_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "title": "Article from Insajderi",
      "url": "https://insajderi.org/...",
      "publication_source": "Insajderi",
      "created_at": "2024-01-15T10:25:00.000Z"
    }
    // ... one article from each available provider
  ]
}
```

## Key Features

- **Perfect Size**: Always returns exactly 10 articles
- **All Providers Guaranteed**: Every provider gets at least 1 article
- **Priority-Based Selection**: Higher priority providers get preference in case of ties
- **Duplicate-Free**: Removes similar articles across providers before selection
- **Fast Performance**: Optimized for quick daily news overview
- **Configurable Filtering**: Same powerful duplicate detection as `all-articles`

## Expected Response Size

- **Always**: Exactly 10 articles
- **Distribution**: Balanced across all available providers
- **Priority Respected**: Higher priority providers get more articles when possible

## Use Cases

- **Daily News Digest**: Perfect for morning news summaries
- **Homepage Headlines**: Perfect 10-article digest with balanced coverage
- **News Aggregator Widgets**: Balanced coverage for news widgets
- **Mobile Apps**: Lightweight endpoint for quick news overviews

## Performance

The function is optimized for speed:

- Fetches only 50 articles initially (vs. 100+ for all-articles)
- Uses same caching mechanisms as all-articles
- Simple selection algorithm (first article per provider after sorting)
- Minimal memory footprint

## Comparison with all-articles

| Feature               | daily-articles | all-articles  |
| --------------------- | -------------- | ------------- |
| Articles per provider | 1-3 (smart)    | 5 (max)       |
| Total articles        | 10 (exact)     | ~30           |
| Pagination            | No             | Yes           |
| Use case              | Daily overview | Full browsing |
| Performance           | Faster         | Slower        |
