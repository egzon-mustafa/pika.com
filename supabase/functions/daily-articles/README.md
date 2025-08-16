# Daily Articles Function

This Supabase Edge Function provides a curated daily news overview by returning exactly **two articles per provider**, ensuring balanced coverage across all news sources.

## Overview

The `daily-articles` function is designed to give users a quick daily snapshot of news from all available providers. Unlike the `all-articles` function which can return many articles per provider, this function limits the response to exactly two representative articles from each news source.

## How it works

1. **Fetches Recent Articles**: Retrieves the 50 most recent articles from all providers
2. **Applies Duplicate Filtering**: Removes similar articles using Jaro-Winkler distance algorithm
3. **Sorts by Priority**: Orders articles by provider priority and recency
4. **Selects Two Per Provider**: Takes the two best (most recent, highest priority) articles from each provider

## Provider Priority Order

The function respects the same priority ranking as `all-articles`:

1. **Telegrafi** (highest priority)
2. **Insajderi**
3. **IndeksOnline**
4. **Gazeta Express**
5. **BotaSot**
6. **Gazeta Blic** (lowest priority)

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
  "total_after_filtering": 12,
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

- **Guaranteed Diversity**: Always returns two articles per provider (maximum 12 articles)
- **Priority-Based Selection**: Higher priority providers get preference in case of ties
- **Duplicate-Free**: Removes similar articles across providers before selection
- **Fast Performance**: Optimized for quick daily news overview
- **Configurable Filtering**: Same powerful duplicate detection as `all-articles`

## Expected Response Size

- **Maximum**: 12 articles (two from each provider)
- **Typical**: 8-12 articles (depending on which providers have recent content)
- **Minimum**: 2 articles (if only one provider has content)

## Use Cases

- **Daily News Digest**: Perfect for morning news summaries
- **Homepage Headlines**: Two representative articles from each news source
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
| Articles per provider | 2 (max)        | 5 (max)       |
| Total articles        | ~12            | ~30           |
| Pagination            | No             | Yes           |
| Use case              | Daily overview | Full browsing |
| Performance           | Faster         | Slower        |
