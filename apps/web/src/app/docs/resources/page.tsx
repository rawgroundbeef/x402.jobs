import Link from "next/link";

export default function ResourcesApiPage() {
  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/docs"
          className="text-primary hover:text-primary/80 transition-colors"
        >
          Documentation
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">Resources API</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-foreground">
        Resources API Reference
      </h1>

      <p className="text-xl text-muted-foreground">
        Complete reference for managing resources via the x402.jobs API.
      </p>

      {/* Base URL */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">Base URL</h2>
        <code className="text-primary bg-muted px-3 py-1.5 rounded font-mono">
          https://api.x402.jobs/api/v1
        </code>
      </div>

      <h2 className="text-2xl font-semibold text-foreground">
        Discovery API (Public)
      </h2>
      <p className="text-muted-foreground">
        Public endpoints for discovering resources and checking trust scores. No
        API key required.
      </p>

      {/* LIST PUBLIC RESOURCES */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
            GET
          </span>
          <code className="text-lg text-foreground font-mono">/resources</code>
          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-medium">
            Public
          </span>
        </div>

        <p className="text-muted-foreground">
          Browse all x402 resources with trust scores. Returns resources sorted
          by popularity by default.
        </p>

        <h3 className="font-semibold text-foreground">Query Parameters</h3>
        <ul className="text-muted-foreground space-y-1">
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              search
            </code>{" "}
            - Search by name, description, or URL
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              network
            </code>{" "}
            - Filter by network (solana, base)
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              category
            </code>{" "}
            - Filter by category
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              sort
            </code>{" "}
            - Sort order: popular (default), latest, price_low, price_high,
            top_earning
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              limit
            </code>{" "}
            - Results per page (default: 25, max: 100)
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              offset
            </code>{" "}
            - Pagination offset
          </li>
        </ul>

        <h3 className="font-semibold text-foreground">Response</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "resources": [
    {
      // Identity
      "id": "uuid",
      "name": "server-slug/resource-slug",
      "url": "https://api.example.com/endpoint",
      "description": "Resource description",
      "avatar_url": "https://...",
      "x402jobs_url": "https://x402.jobs/resources/server/resource",

      // Trust Scores
      "success_rate": 0.94,         // 0-1 decimal (30-day success rate)
      "calls": 1240,                // Total call count
      "value_processed": "$12.4k",  // Total USDC earned (formatted)
      "last_called": "2m ago",      // Relative time

      // Raw stats (for custom calculations)
      "success_count_30d": 1165,
      "failure_count_30d": 75,
      "call_count": 1240,
      "total_earned_usdc": "12400.50",
      "last_called_at": "2024-01-15T10:30:00Z",

      // Payment info
      "network": "solana",
      "price": "5000000"            // Amount in smallest unit
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  }
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`# Browse popular resources with trust scores
curl "https://api.x402.jobs/api/v1/resources?sort=popular&limit=10"

# Filter by network
curl "https://api.x402.jobs/api/v1/resources?network=solana&sort=popular"`}
          </code>
        </pre>
      </div>

      {/* CHECK RESOURCE */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
            GET
          </span>
          <code className="text-lg text-foreground font-mono">
            /resources/check
          </code>
          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-medium">
            Public
          </span>
        </div>

        <p className="text-muted-foreground">
          Check the trust score of a specific resource URL. Use this when you
          have a URL and want to verify its reliability before paying.
        </p>

        <h3 className="font-semibold text-foreground">Query Parameters</h3>
        <ul className="text-muted-foreground space-y-1">
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              url
            </code>{" "}
            (required) - Resource URL to check (protocol optional)
          </li>
        </ul>

        <h3 className="font-semibold text-foreground">Response (found)</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "found": true,
  "resource": {
    "id": "uuid",
    "name": "server-slug/resource-slug",
    "slug": "resource-slug",
    "server_slug": "server-slug",
    "avatar_url": "https://...",
    "resource_url": "https://api.example.com/endpoint",
    "success_rate": 94,            // 0-100 percentage
    "call_count": 1240,
    "last_called_at": "2024-01-15T10:30:00Z",
    "total_earned_usdc": "12400.50"
  }
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Response (not found)</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "found": false,
  "url": "api.example.com/unknown"
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`# Check a resource's trust score
curl "https://api.x402.jobs/api/v1/resources/check?url=api.example.com/endpoint"`}
          </code>
        </pre>
      </div>

      {/* Trust Score Interpretation */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Interpreting Trust Scores
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">success_rate</h3>
            <p className="text-muted-foreground mb-2">
              Percentage of successful calls in the last 30 days. Recommended
              thresholds:
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <span className="text-emerald-400 font-medium">{">"}= 95%</span>{" "}
                - High reliability
              </li>
              <li>
                <span className="text-yellow-400 font-medium">80-94%</span> -
                Moderate reliability
              </li>
              <li>
                <span className="text-red-400 font-medium">{"<"} 80%</span> -
                Use with caution
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">calls</h3>
            <p className="text-muted-foreground">
              Total number of tracked calls. Higher counts indicate more usage
              data and reliable success_rate calculations.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              value_processed
            </h3>
            <p className="text-muted-foreground">
              Total USDC processed through this resource. Indicates economic
              activity and trust from other agents.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold text-foreground pt-8 border-t border-border">
        Management API (Authenticated)
      </h2>
      <p className="text-muted-foreground">
        Authenticated endpoints for managing your own resources. Requires an API
        key from{" "}
        <Link href="/dashboard/api-keys" className="text-primary">
          your dashboard
        </Link>
        .
      </p>

      {/* CREATE RESOURCE */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-semibold">
            POST
          </span>
          <code className="text-lg text-foreground font-mono">/resources</code>
        </div>

        <p className="text-muted-foreground">
          Create a new resource on the platform.
        </p>

        <h3 className="font-semibold text-foreground">Request Body</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "name": "string (required)",
  "description": "string (optional)",
  "resource_url": "string (required)",
  "category": "string (optional, default: 'api')",
  "tags": ["string"] (optional),
  "capabilities": ["string"] (optional),
  "server_name": "string (optional)",
  "extra": {} (optional)
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Response</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "resource_url": "string",
    "category": "string",
    "server_id": "uuid",
    "created_at": "ISO 8601 datetime"
  }
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X POST https://api.x402.jobs/api/v1/resources \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Text Processor API",
    "description": "Advanced text processing and analysis",
    "resource_url": "https://myapi.com/process",
    "category": "nlp",
    "tags": ["text", "nlp", "analysis"],
    "capabilities": ["sentiment analysis", "text summarization"],
    "server_name": "TextCorp APIs"
  }'`}
          </code>
        </pre>
      </div>

      {/* GET RESOURCES */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
            GET
          </span>
          <code className="text-lg text-foreground font-mono">/resources</code>
        </div>

        <p className="text-muted-foreground">
          List all resources created by your API key.
        </p>

        <h3 className="font-semibold text-foreground">Query Parameters</h3>
        <ul className="text-muted-foreground space-y-1">
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              page
            </code>{" "}
            (optional, default: 1) - Page number
          </li>
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              limit
            </code>{" "}
            (optional, default: 20, max: 100) - Number of results per page
          </li>
        </ul>

        <h3 className="font-semibold text-foreground">Response</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "slug": "string",
      "description": "string",
      "resource_url": "string",
      "category": "string",
      "tags": ["string"],
      "capabilities": ["string"],
      "server_id": "uuid",
      "created_at": "ISO 8601 datetime",
      "updated_at": "ISO 8601 datetime",
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "has_more": false
  }
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X GET "https://api.x402.jobs/api/v1/resources?page=1&limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`}
          </code>
        </pre>
      </div>

      {/* GET RESOURCE */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm font-semibold">
            GET
          </span>
          <code className="text-lg text-foreground font-mono">
            /resources/:id
          </code>
        </div>

        <p className="text-muted-foreground">
          Get details of a specific resource.
        </p>

        <h3 className="font-semibold text-foreground">URL Parameters</h3>
        <ul className="text-muted-foreground">
          <li>
            <code className="text-primary bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
              id
            </code>{" "}
            (required) - Resource UUID
          </li>
        </ul>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X GET https://api.x402.jobs/api/v1/resources/550e8400-e29b-41d4-a716-446655440000 \\
  -H "x-api-key: YOUR_API_KEY"`}
          </code>
        </pre>
      </div>

      {/* UPDATE RESOURCE */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-semibold">
            PUT
          </span>
          <code className="text-lg text-foreground font-mono">
            /resources/:id
          </code>
        </div>

        <p className="text-muted-foreground">
          Update an existing resource. Only provide fields you want to change.
        </p>

        <h3 className="font-semibold text-foreground">Request Body</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "name": "string (optional)",
  "description": "string (optional)",
  "resource_url": "string (optional)",
  "category": "string (optional)",
  "tags": ["string"] (optional),
  "capabilities": ["string"] (optional),
  "extra": {} (optional)
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X PUT https://api.x402.jobs/api/v1/resources/550e8400-e29b-41d4-a716-446655440000 \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "description": "Updated description for my API",
    "tags": ["text", "nlp", "analysis", "updated"]
  }'`}
          </code>
        </pre>
      </div>

      {/* DELETE RESOURCE */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-semibold">
            DELETE
          </span>
          <code className="text-lg text-foreground font-mono">
            /resources/:id
          </code>
        </div>

        <p className="text-muted-foreground">
          Delete a resource (soft delete - resource is deactivated).
        </p>

        <h3 className="font-semibold text-foreground">Response</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "success": true,
  "message": "Resource deleted successfully"
}`}
          </code>
        </pre>

        <h3 className="font-semibold text-foreground">Example</h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X DELETE https://api.x402.jobs/api/v1/resources/550e8400-e29b-41d4-a716-446655440000 \\
  -H "x-api-key: YOUR_API_KEY"`}
          </code>
        </pre>
      </div>

      {/* Field Descriptions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Field Descriptions
        </h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Resource Fields
            </h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  name
                </code>{" "}
                - Display name of the resource
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  description
                </code>{" "}
                - Detailed description
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  resource_url
                </code>{" "}
                - The actual endpoint URL
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  category
                </code>{" "}
                - Resource category (api, tool, service, etc.)
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2">
              Optional Fields
            </h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  tags
                </code>{" "}
                - Array of tags for discoverability
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  capabilities
                </code>{" "}
                - What the resource can do
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  server_name
                </code>{" "}
                - Groups resources under a server
              </li>
              <li>
                <code className="text-primary bg-muted px-1.5 py-0.5 rounded font-mono">
                  extra
                </code>{" "}
                - Additional metadata
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
