# Crawl BotaSot Function

This Supabase Edge Function crawls articles from BotaSot.info and saves them to the database.

## Overview

BotaSot.info is a Kosovo news website that publishes articles in Albanian. This function specifically targets their main page structure that contains the latest featured articles in a specific layout with one main article and several smaller articles.

## How it works

1. **Article Discovery**: The function fetches the main page of BotaSot.info and parses the HTML using Cheerio
2. **Extraction**: It extracts articles from the main section using CSS selectors targeting specific article layouts
3. **Data Parsing**: For each article, it extracts:
   - Title (from h1 for main article, h2 for smaller articles within `.title-part`)
   - URL (from the `href` attribute)
   - Image URL (from img src or data-src attributes for lazy loading)
   - Publication source ("botasot")
   - Publication date (defaults to "Sot" - Today in Albanian)

## Article Structure

The function targets articles within this HTML structure:

```html
<div class="row clear up-section">
  <!-- Main big article (left side) -->
  <div class="col-md-6 col-sm-12 col-xs-12 left-view">
    <div class="big-article artikulli-kryesor">
      <a href="/article-url">
        <img src="image-url" alt="Article Title" />
        <div class="title-part">
          <h1>Main Article Title</h1>
          <p>Article description...</p>
        </div>
      </a>
    </div>
  </div>

  <!-- Smaller articles (right side) -->
  <div class="col-md-3 col-sm-12 col-xs-12 right-view">
    <div class="small-article">
      <a href="/article-url">
        <img src="image-url" alt="Article Title" />
        <div class="title-part">
          <h2>Small Article Title</h2>
        </div>
      </a>
    </div>
  </div>
</div>
```

## Provider Configuration

- **Name**: `botasot`
- **Base URL**: `https://www.botasot.info`
- **User Agent**: Standard Chrome user agent
- **Provider enum**: `Provider.BOTASOT`
- **Expected articles**: Maximum 3 articles (1 main + 2 small articles typically)

## API Usage

### Basic Request

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-botasot' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### With Options

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/crawl-botasot?maxPages=5&requestDelay=500' \
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
  "totalArticlesFetched": 3,
  "provider": "botasot",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### No New Articles

```json
{
  "message": "You're all up to date! No new articles found from BotaSot",
  "status": "up-to-date",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Provider Inactive

```json
{
  "message": "BotaSot provider is not active",
  "provider": "botasot",
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

- **Dual Article Types**: Handles both main featured articles (h1 titles) and smaller articles (h2 titles)
- **Lazy Loading Support**: Extracts images from both `src` and `data-src` attributes
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

## Expected Article Count

Based on the HTML structure provided, this crawler typically extracts:

- **1 main article** from the left side (.big-article.artikulli-kryesor)
- **2 smaller articles** from the right side (.small-article)
- **Total: ~3 articles** per crawl session
