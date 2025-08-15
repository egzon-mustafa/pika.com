# Crawl IndeksOnline Function

This Supabase Edge Function crawls articles from IndeksOnline.net and saves them to the database.

## Overview

IndeksOnline.net is a Kosovo news website that publishes articles in Albanian. This function specifically targets their main page carousel/slider that contains the latest featured articles.

## How it works

1. **Article Discovery**: The function fetches the main page of IndeksOnline.net and parses the HTML using Cheerio
2. **Extraction**: It extracts articles from the flexslider carousel using CSS selectors
3. **Data Parsing**: For each article, it extracts:
   - Title (from the `title` attribute of the link or from h2 tag)
   - URL (from the `href` attribute)
   - Image URL (from img src attribute)
   - Publication source ("indeksonline")
   - Publication date (defaults to "Sot" - Today in Albanian)

## Article Structure

The function targets articles within this HTML structure:

```html
<div class="flexslider mainSlide">
  <ul class="slides">
    <li>
      <a href="article-url" title="Article Title">
        <img src="image-url" alt="" />
        <h2>Article Title</h2>
      </a>
    </li>
  </ul>
</div>
```

## Provider Configuration

- **Name**: `indeksonline`
- **Base URL**: `https://indeksonline.net`
- **User Agent**: Standard Chrome user agent
- **Provider enum**: `Provider.INDEKSONLINE`

## API Usage

### Basic Request

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-indeksonline' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### With Options

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-indeksonline?maxPages=5&requestDelay=500' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### Query Parameters

- `maxPages`: Number of pages to scrape (default: 3)
- `requestDelay`: Delay between requests in milliseconds (default: 1000)

## Response Format

### Success Response

```json
{
  "totalArticlesFetched": 5,
  "provider": "indeksonline",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### No New Articles

```json
{
  "message": "You're all up to date! No new articles found from IndeksOnline",
  "status": "up-to-date",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Provider Inactive

```json
{
  "message": "IndeksOnline provider is not active",
  "provider": "indeksonline",
  "active": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response

```json
{
  "error": "Error details",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Features

- **Duplicate Detection**: Automatically filters out articles that already exist in the database
- **Provider Status Check**: Respects provider active/inactive status from database
- **Error Handling**: Comprehensive error handling with detailed logging
- **Batch Processing**: Saves articles in batches for optimal performance
- **Retry Logic**: Built-in retry mechanism for failed HTTP requests

## Logging

The function uses a custom logger that provides color-coded output for different log levels:

- **DEBUG**: Gray - Detailed debugging information
- **INFO**: Cyan - General information
- **WARN**: Yellow - Warning messages
- **ERROR**: Red - Error messages
- **SUCCESS**: Green - Success messages
- **SCRAPING**: Blue - Scraping progress
- **PROCESSING**: Cyan - Processing information
- **STATS**: White - Statistics and summaries

## Database Integration

The function integrates with the existing articles database schema:

- Checks for existing articles to avoid duplicates
- Saves new articles with proper database field mapping
- Provides statistics about total articles in database
- Respects provider status configuration
