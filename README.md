# @x402jobs/sdk

The official SDK for [x402.jobs](https://x402.jobs) — trust, discovery, and resource management for the x402 ecosystem.

## Install

```bash
npm install @x402jobs/sdk
```

## Quick Start

### Check if a resource is reliable

```javascript
import { check } from '@x402jobs/sdk'

const score = await check('https://api.example.com/resource')
// {
//   url: "https://api.example.com/resource",
//   success_rate: 0.94,
//   calls: 1240,
//   value_processed: "$12.4k",
//   last_called: "2m ago"
// }
```

### Browse top resources

```javascript
import { check } from '@x402jobs/sdk'

const top = await check.top({ limit: 20 })
```

### Search resources

```javascript
import { resources } from '@x402jobs/sdk'

const results = await resources.search({
  query: 'image generation',
  minSuccessRate: 0.9
})
```

### Register your resource

```javascript
import { resources, configure } from '@x402jobs/sdk'

configure({ apiKey: 'your-api-key' })

await resources.register({
  url: 'https://my-api.com/endpoint',
  name: 'My API',
  price: '$0.01'
})
```

## Why?

You can index x402 endpoints all day. Doesn't mean they work.

x402jobs gives you reliability scores backed by real paid usage — not synthetic pings.

We ran the transactions. We paid the fees. Now you get the data.

## API Reference

### Trust / Verification

| Function | Description |
|----------|-------------|
| `check(url)` | Get reliability score for a resource |
| `check.many(urls)` | Check multiple resources |
| `check.exists(url)` | Check if resource is indexed |
| `check.top(options)` | Get top-ranked resources |

### Resources

| Function | Description |
|----------|-------------|
| `resources.list()` | Get all resources |
| `resources.get(url)` | Get single resource |
| `resources.search(options)` | Search resources |
| `resources.register(input)` | Register new resource |
| `resources.update(id, input)` | Update resource |
| `resources.delete(id)` | Delete resource |

### Configuration

| Function | Description |
|----------|-------------|
| `configure({ apiKey })` | Set API key for unlimited access |
| `configure({ baseUrl })` | Set custom API URL |

## Error Handling

```javascript
import { X402Error } from '@x402jobs/sdk'

try {
  const score = await check(url)
} catch (err) {
  if (err instanceof X402Error) {
    console.log(err.code)     // Error code
    console.log(err.message)  // Human readable
    console.log(err.status)   // HTTP status
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not indexed |
| `PAYMENT_REQUIRED` | x402 payment failed |
| `RATE_LIMITED` | Too many requests |
| `UNAUTHORIZED` | Invalid or missing API key |
| `FORBIDDEN` | Not allowed |
| `VALIDATION_ERROR` | Invalid input |
| `SERVER_ERROR` | x402jobs API error |

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  Score,
  Resource,
  ResourceSearchOptions
} from '@x402jobs/sdk'
```

## Docs

Full documentation at [x402.jobs/docs](https://x402.jobs/docs)

## License

MIT
