# x402.jobs

Chain X402 resources into automated workflows. Like N8N, but for pay-per-use APIs.

## Overview

x402.jobs is a visual workflow builder that lets you:

1. **Register X402 Resources** - Add any X402 endpoint to the marketplace
2. **Chain Resources** - Connect resources together to build workflows
3. **Trigger Workflows** - Run manually, on schedule, or via webhook
4. **Get Results** - Save outputs to UI, Telegram, email, or storage

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev --filter x402-jobs
```

The app runs on `http://localhost:3010`.

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Workflow Builder**: XYFlow (React Flow)
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Auth**: Supabase Auth

## Database Tables

- `x402_resources` - Registered X402 endpoints
- `x402_jobs` - User-created workflows
- `x402_job_runs` - Execution history

## Pages

- `/` - Landing page
- `/resources` - Browse X402 resources
- `/resources/register` - Register a new resource
- `/jobs` - View your jobs
- `/jobs/new` - Create a new job (workflow builder)

## Node Types

### Trigger Node

- **Manual** - Run on demand
- **Schedule** - Run on cron schedule
- **Webhook** - Run when webhook is called

### Resource Node

- Select any registered X402 resource
- Shows price per call
- Connect to chain outputs → inputs

### Output Node

- **UI** - View results in dashboard
- **Telegram** - Send to Telegram chat
- **Email** - Send via email
- **Bucket** - Save to storage

## License

MIT
