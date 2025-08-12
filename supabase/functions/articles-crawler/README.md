# Articles Crawler

A modular and professional articles crawler for scraping news articles from various Albanian news sources and storing them in Supabase.

## Architecture

The crawler is built with a modular architecture that makes it easy to add, remove, or modify news providers:

```
articles-crawler/
├── index.ts              # Main entry point and API handler
├── types/                # TypeScript interfaces and base classes
│   └── index.ts          # Core types and BaseProvider class
├── services/             # Core business logic
│   ├── crawler.ts        # Main crawler orchestration service
│   └── database.ts       # Database operations service
├── providers/            # News source implementations
│   ├── index.ts          # Provider exports and registry
│   ├── telegrafi.ts      # Telegrafi.com implementation
│   └── insajderi.ts      # Insajderi.org implementation
└── README.md             # This file
```

## Features

### 🏗️ Modular Architecture

- **Separate providers**: Each news source has its own dedicated file
- **Base provider class**: Common functionality shared across all providers
- **Service layer**: Dedicated services for database operations and crawler orchestration
- **Type safety**: Comprehensive TypeScript interfaces throughout

### 🚀 Performance & Reliability

- **Retry logic**: Automatic retry with exponential backoff for failed requests
- **Rate limiting**: Respectful delays between requests to avoid overwhelming servers
- **Batch processing**: Efficient database operations with batch inserts
- **Error handling**: Comprehensive error handling with detailed logging
- **Duplicate prevention**: Automatic detection and prevention of duplicate articles

### 🔧 Configurable Options

- **Flexible API**: Query parameters for customizing crawling behavior
- **Provider selection**: Choose specific providers to run
- **Page limits**: Configure how many pages to scrape per provider
- **Request delays**: Customize delays between requests

### 📊 Monitoring & Logging

- **Detailed logging**: Comprehensive logs with emojis for easy reading
- **Performance metrics**: Timing and statistics for each crawling session
- **Error tracking**: Detailed error reporting and aggregation
- **Database statistics**: Real-time database statistics and summaries

## API Usage

### Basic Usage (All Providers)

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### With Custom Options

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler?maxPages=5&requestDelay=500' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### Specific Providers Only

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/articles-crawler?providers=telegrafi' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### Query Parameters

| Parameter      | Type   | Default | Description                              |
| -------------- | ------ | ------- | ---------------------------------------- |
| `maxPages`     | number | 3       | Number of pages to scrape per provider   |
| `requestDelay` | number | 1000    | Delay between requests in milliseconds   |
| `providers`    | string | all     | Comma-separated list of providers to use |

### Response Format

```typescript
{
  "totalArticlesFetched": number,
  "providers": string[],
  "errors"?: string[]  // Only included if errors occurred
}
```

## Available Providers

### Telegrafi (`telegrafi`)

- **Source**: https://telegrafi.com/ne-trend/
- **Pages**: Supports multiple pages (configurable)
- **Content**: Trending news articles
- **Features**: Image extraction, publication date parsing

### Insajderi (`insajderi`)

- **Source**: https://insajderi.org/category/lajme/
- **Pages**: Single page with featured articles
- **Content**: Main featured article + additional articles
- **Features**: Image extraction, structured content extraction

## Adding New Providers

To add a new news provider:

1. **Create provider file**: Add a new file in `providers/` directory
2. **Extend BaseProvider**: Inherit from the BaseProvider class
3. **Implement scrapeArticles**: Implement the abstract method
4. **Register provider**: Add to the AVAILABLE_PROVIDERS registry
5. **Update types**: Add to ProviderName type if using TypeScript

### Example Provider Implementation

```typescript
import {
  Article,
  BaseProvider,
  ProviderConfig,
  ScrapingOptions,
} from "../types/index.ts";

export class NewProviderClass extends BaseProvider {
  constructor(options: ScrapingOptions = {}) {
    const config: ProviderConfig = {
      name: "newprovider",
      baseUrl: "https://example.com",
    };
    super(config, options);
  }

  async scrapeArticles(): Promise<Article[]> {
    // Implementation here
    return [];
  }
}
```

## Environment Variables

The crawler requires the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `SUPABASE_ANON_KEY`: Authentication key

## Database Schema

The crawler expects an `articles` table with the following columns:

```sql
CREATE TABLE articles (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  image_url TEXT,
  publication_date TIMESTAMPTZ NOT NULL,
  publication_source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Development

### Running Locally

1. Start Supabase: `supabase start`
2. Deploy function: `supabase functions deploy articles-crawler`
3. Test the endpoint using curl or your preferred HTTP client

### Testing Providers

You can test individual providers without saving to the database by using the `testProvider` method in the CrawlerService class.

## Best Practices

### Respectful Scraping

- Always include appropriate delays between requests
- Respect robots.txt files (enabled by default)
- Use realistic user agents
- Implement proper error handling and retries

### Code Quality

- Follow TypeScript best practices
- Use meaningful variable and function names
- Include comprehensive error handling
- Add logging for debugging and monitoring
- Write clean, maintainable code

### Performance

- Use batch operations for database inserts
- Implement proper caching where appropriate
- Monitor and optimize scraping performance
- Consider implementing request queuing for high-volume scenarios

## Contributing

When contributing to this project:

1. Follow the existing code style and patterns
2. Add comprehensive error handling
3. Include appropriate logging
4. Test your changes thoroughly
5. Update this README if you add new features
