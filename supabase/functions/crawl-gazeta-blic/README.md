# Crawl Gazeta Blic Function

This Supabase Edge Function crawls articles specifically from **GazetaBlic.com** and saves them to the database.

## Overview

This is a standalone function that extracts the Gazeta Blic crawler logic from the main `articles-crawler` function. It provides dedicated crawling for Gazeta Blic with the same robust error handling and database integration.

## Features

- **Dedicated Gazeta Blic crawling**: Focuses solely on GazetaBlic.com
- **Duplicate detection**: Automatically filters out existing articles
- **Configurable options**: Supports custom scraping parameters
- **Provider status checking**: Checks if the provider is active before crawling
- **Comprehensive logging**: Detailed logging with emojis for easy debugging
- **Error handling**: Robust error handling with detailed error reporting
- **Multiple selector fallbacks**: Uses progressive fallback selectors for robust article extraction

## API Usage

### Basic Usage

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-blic' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### With Options

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-blic?maxPages=5&requestDelay=500' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

## Query Parameters

- `maxPages`: Number of pages to scrape (default: 3)
- `requestDelay`: Delay between requests in milliseconds (default: 1000)

## Response Format

### Success Response

```json
{
  "totalArticlesFetched": 5,
  "provider": "gazeta-blic",
  "errors": []
}
```

### Provider Inactive Response

```json
{
  "message": "Gazeta Blic provider is not active",
  "provider": "gazeta-blic",
  "active": false,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Up-to-Date Response

```json
{
  "message": "You're all up to date! No new articles found from Gazeta Blic",
  "status": "up-to-date",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Error Response

```json
{
  "error": "Error details...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Architecture

The function follows the same modular architecture as other crawler functions:

```
crawl-gazeta-blic/
├── index.ts                 # Main function handler
├── deno.json               # Deno configuration
├── providers/
│   └── gazeta-blic.ts      # Gazeta Blic scraping logic
├── services/
│   └── database.ts         # Database operations
├── types/
│   └── index.ts           # TypeScript definitions
├── utils/
│   └── logger.ts          # Logging utilities
└── README.md              # This file
```

## Scraping Strategy

The Gazeta Blic provider uses a sophisticated fallback strategy to extract articles:

1. **Primary selector**: `.zgjedhjet_slider li.zgjedhet_slide.pdk_tag.blic_featured`
2. **Fallback 1**: `.zgjedhjet_slider li.zgjedhet_slide`
3. **Fallback 2**: `.zgjedhjet_slider li`
4. **Final fallback**: Any `li` element with a link

This ensures reliable article extraction even if the site structure changes.

## Extracted Data

For each article, the function extracts:

- **Title**: From `h1` elements within article content
- **URL**: From the main article link
- **Image**: From `.thumb-holder img` or fallback img elements
- **Publication Date**: From `.date-time.date-human` elements (fallback: "Sot")
- **Source**: Set to "gazeta-blic"

## Environment Variables

The function requires the following environment variables to be set in your Supabase project:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `SUPABASE_ANON_KEY`: Database access key

## Database Tables

The function interacts with these database tables:

- `articles`: Stores the scraped articles
- `news_providers`: Manages provider status (active/inactive)

## Deployment

To deploy this function to your Supabase project:

```bash
supabase functions deploy crawl-gazeta-blic
```

## Local Development

To run locally:

```bash
supabase start
supabase functions serve crawl-gazeta-blic
```

## Monitoring

The function provides comprehensive logging that can be viewed in the Supabase dashboard or accessed via the CLI:

```bash
supabase functions logs crawl-gazeta-blic
```

## Related Functions

- `articles-crawler`: Main crawler that handles multiple providers
- `crawl-telegrafi`: Dedicated Telegrafi crawler
- `crawl-insajderi`: Dedicated Insajderi crawler
- `crawl-gazeta-express`: Dedicated Gazeta Express crawler
