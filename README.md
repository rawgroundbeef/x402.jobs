# @x402jobs/sdk

The official SDK for [x402.jobs](https://x402.jobs) — trust, discovery, and resource management for the x402 ecosystem.

## Install

```bash
npm install @x402jobs/sdk
```

## Quick Start

```javascript
import { X402Jobs } from '@x402jobs/sdk'

const x402 = new X402Jobs({ apiKey: 'your-api-key' })
```

### Check if a resource is reliable

```javascript
const score = await x402.check('https://api.example.com/resource')
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
const top = await x402.check.top({ limit: 20 })
```

### Search resources

```javascript
const results = await x402.resources.search({
  query: 'image generation',
  minSuccessRate: 0.9
})
```

### Register your resource

```javascript
await x402.resources.register({
  url: 'https://my-api.com/endpoint',
  name: 'My API',
  price: '$0.01'
})
```

## Why?

You can index x402 endpoints all day. Doesn't mean they work.

x402jobs gives you reliability scores backed by real paid usage — not synthetic pings.

We ran the transactions. We paid the fees. Now you get the data.

## Stacks Support

The SDK includes built-in support for Stacks blockchain payments (STX, sBTC, USDCx).

### Create payment requirements

```typescript
import { createPaymentRequirements } from '@x402jobs/sdk'

const requirements = createPaymentRequirements({
  payTo: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9',
  amount: '0.001', // Human-readable (0.001 STX)
  token: 'STX',
  network: 'mainnet',
})
// Returns x402 v2 payment requirements ready for use with OpenFacilitator
```

### Amount conversion helpers

```typescript
import { toBaseUnits, fromBaseUnits } from '@x402jobs/sdk'

// Convert to base units for transactions
toBaseUnits('1.5', 'STX')   // "1500000" (microSTX)
toBaseUnits('0.001', 'sBTC') // "100000" (satoshis)

// Convert from base units for display
fromBaseUnits('1000000', 'STX') // "1.0"
```

### Use with OpenFacilitator

```typescript
import { OpenFacilitator } from '@openfacilitator/sdk'
import { createPaymentRequirements } from '@x402jobs/sdk'

const facilitator = new OpenFacilitator()

const requirements = createPaymentRequirements({
  payTo: 'SP...',
  amount: '0.001',
  token: 'STX',
  network: 'mainnet',
})

// Settlement happens via OpenFacilitator
const result = await facilitator.settle(paymentPayload, requirements)
```

### Token contracts

| Token | Mainnet | Testnet |
|-------|---------|---------|
| STX | Native | Native |
| sBTC | `SM3V...sbtc-token` | `ST1F...sbtc-token` |
| USDCx | `SP120...usdcx` | `ST1N...token-susdc` |

## API Reference

### Constructor

```javascript
const x402 = new X402Jobs({
  apiKey: 'sk_...',           // API key for authenticated access
  baseUrl: 'https://...',     // Custom API URL (optional)
})
```

### Trust / Verification (`x402.check`)

| Method | Description |
|--------|-------------|
| `check(url)` | Get reliability score for a resource |
| `check.many(urls)` | Check multiple resources |
| `check.exists(url)` | Check if resource is indexed |
| `check.top(options)` | Get top-ranked resources |

### Resources (`x402.resources`)

| Method | Description |
|--------|-------------|
| `resources.list()` | Get all resources |
| `resources.get(url)` | Get single resource |
| `resources.search(options)` | Search resources |
| `resources.register(input)` | Register new resource |
| `resources.update(id, input)` | Update resource |
| `resources.delete(id)` | Delete resource |

## Error Handling

```javascript
import { X402Jobs, X402Error } from '@x402jobs/sdk'

const x402 = new X402Jobs({ apiKey: 'sk_...' })

try {
  const score = await x402.check(url)
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
import { X402Jobs } from '@x402jobs/sdk'
import type { Score, Resource, ClientOptions } from '@x402jobs/sdk'

// Stacks types
import type {
  StacksNetwork,
  StacksTokenType,
  StacksPaymentConfig,
  StacksPaymentRequirements,
} from '@x402jobs/sdk'
```

## Docs

Full documentation at [x402.jobs/docs](https://x402.jobs/docs)

## License

MIT
