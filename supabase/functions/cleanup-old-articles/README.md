# Cleanup Old Articles Function

This Supabase Edge Function automatically removes articles that are older than X days (configurable via environment variable, defaults to 5 days) based on their `created_at` timestamp. This helps keep your database optimized and removes stale content.

## Features

- ✅ Configurable cleanup period via `CLEANUP_DAYS_OLD` environment variable
- ✅ Deletes articles older than specified days (default: 5 days)
- ✅ Uses `created_at` timestamp for accurate date filtering
- ✅ Counts articles before deletion for reporting
- ✅ Safe POST-only endpoint
- ✅ Input validation for environment variables
- ✅ Comprehensive error handling
- ✅ Detailed logging with emojis (uses shared logger utility)
- ✅ Returns detailed cleanup summary

## Usage

### Manual Trigger

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cleanup-old-articles' \
  --header 'Authorization: Bearer <your_anon_jwt>' \
  --header 'Content-Type: application/json'
```

### Response Format

```json
{
  "deletedCount": 25,
  "cutoffDate": "2024-01-10T10:30:00.000Z",
  "success": true,
  "message": "Successfully deleted 25 articles older than 5 days",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Configuration Examples

**Keep articles for 3 days:**

```bash
# Set environment variable
export CLEANUP_DAYS_OLD=3

# Or set in your deployment config
CLEANUP_DAYS_OLD=3
```

**Keep articles for 7 days:**

```bash
export CLEANUP_DAYS_OLD=7
```

## Automation Options

### 1. Cron Job (Recommended)

Set up a cron job to run the cleanup daily:

```bash
# Run cleanup every day at 2 AM
0 2 * * * curl -X POST "https://your-project.supabase.co/functions/v1/cleanup-old-articles" -H "Authorization: Bearer YOUR_ANON_KEY"
```

### 2. Supabase Cron (If Available)

Use Supabase's built-in cron functionality if available in your plan.

### 3. GitHub Actions

Create a workflow that runs the cleanup on a schedule.

## Configuration

The cleanup function uses these environment variables:

- `CLEANUP_DAYS_OLD` - Number of days to keep articles (default: 5)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

### Environment Variable Details

| Variable                    | Required | Default | Description                                     |
| --------------------------- | -------- | ------- | ----------------------------------------------- |
| `CLEANUP_DAYS_OLD`          | No       | `5`     | Number of days to keep articles before deletion |
| `SUPABASE_URL`              | Yes      | -       | Your Supabase project URL                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | -       | Service role key for admin database access      |

### Validation

- `CLEANUP_DAYS_OLD` must be a positive integer
- Invalid values will cause the function to return an error
- Default value (5) is used if the variable is not set

## Safety Features

- **POST-only**: Only accepts POST requests to prevent accidental triggers
- **Count First**: Counts articles before deletion for reporting
- **Error Handling**: Comprehensive error handling with detailed messages
- **Logging**: Detailed console logging for monitoring

## Monitoring

The function provides detailed logging using the same logger as articles-crawler:

- 🚀 Starting cleanup operations
- 📊 Article count information
- ✅ Success confirmations
- ❌ Error details

Monitor your function logs to ensure cleanup is working as expected.
