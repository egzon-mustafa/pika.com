# Crawl Gazeta Express Function

This Supabase Edge Function crawls articles specifically from **GazetaExpress.com** and saves them to the database.

## Overview

This is a standalone function that extracts the Gazeta Express crawler logic from the main `articles-crawler` function. It provides dedicated crawling for Gazeta Express with the same robust error handling and database integration.

## Features

- **Dedicated Gazeta Express crawling**: Focuses solely on GazetaExpress.com
- **Duplicate detection**: Automatically filters out existing articles
- **Configurable options**: Supports custom scraping parameters
- **Provider status checking**: Checks if the provider is active before crawling
- **Comprehensive logging**: Detailed logging with emojis for easy debugging
- **Error handling**: Robust error handling with detailed error reporting

## API Usage

### Basic Usage

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-express' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### With Options

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-gazeta-express?maxPages=5&requestDelay=500' \
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
  "provider": "gazeta-express",
  "errors": []
}
```

### Provider Inactive Response

```json
{
  "message": "Gazeta Express provider is not active",
  "provider": "gazeta-express",
  "active": false,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Up-to-Date Response

```json
{
  "message": "You're all up to date! No new articles found from Gazeta Express",
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
crawl-gazeta-express/
├── index.ts                 # Main function handler
├── deno.json               # Deno configuration
├── providers/
│   └── gazeta-express.ts   # Gazeta Express scraping logic
├── services/
│   └── database.ts         # Database operations
├── types/
│   └── index.ts           # TypeScript definitions
├── utils/
│   └── logger.ts          # Logging utilities
└── README.md              # This file
```

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
supabase functions deploy crawl-gazeta-express
```

## Local Development

To run locally:

```bash
supabase start
supabase functions serve crawl-gazeta-express
```

## Monitoring

The function provides comprehensive logging that can be viewed in the Supabase dashboard or accessed via the CLI:

```bash
supabase functions logs crawl-gazeta-express
```

## Related Functions

- `articles-crawler`: Main crawler that handles multiple providers
- `crawl-telegrafi`: Dedicated Telegrafi crawler
- `crawl-insajderi`: Dedicated Insajderi crawler
