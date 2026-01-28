import Link from "next/link";

export default function GettingStartedPage() {
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
        <span className="text-muted-foreground">Getting Started</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-foreground">
        Getting Started
      </h1>

      {/* Prerequisites Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Prerequisites
        </h2>
        <ul className="text-muted-foreground space-y-1">
          <li>• An x402.jobs account</li>
          <li>• Basic understanding of REST APIs</li>
          <li>• Knowledge of HTTP requests and JSON</li>
        </ul>
      </div>

      {/* Step 1 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          1. Create an API Key
        </h2>
        <p className="text-muted-foreground">
          To use the x402.jobs API, you'll need an API key. Here's how to create
          one:
        </p>

        <ol className="list-decimal list-inside text-muted-foreground space-y-2">
          <li>Log in to your x402.jobs account</li>
          <li>
            Go to{" "}
            <Link
              href="/dashboard/api-keys"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Dashboard → API Keys
            </Link>
          </li>
          <li>Click "Create API Key"</li>
          <li>Give your key a descriptive name (e.g., "My App Integration")</li>
          <li>
            Copy and securely store your API key - it will only be shown once!
          </li>
        </ol>

        {/* Security Notice */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive font-medium">
            🔒 Security Notice: Keep your API key secret! Don't commit it to
            version control or share it publicly. Treat it like a password.
          </p>
        </div>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          2. Make Your First Request
        </h2>
        <p className="text-muted-foreground">
          Once you have your API key, you can start making requests. Here's how
          to create a resource:
        </p>

        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`curl -X POST https://api.x402.jobs/api/v1/resources \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Awesome API",
    "description": "A powerful API for data processing",
    "resource_url": "https://myapi.example.com/v1/process",
    "category": "api",
    "tags": ["data", "processing", "automation"],
    "capabilities": ["text processing", "data analysis"],
    "server_name": "My Company APIs"
  }'`}
          </code>
        </pre>

        <h3 className="text-xl font-semibold text-foreground">
          Expected Response
        </h3>
        <pre className="bg-muted rounded-lg p-4 overflow-x-auto">
          <code className="text-sm font-mono text-foreground">
            {`{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Awesome API",
    "slug": "my-awesome-api",
    "resource_url": "https://myapi.example.com/v1/process",
    "category": "api",
    "server_id": "660e8400-e29b-41d4-a716-446655440001",
    "created_at": "2024-01-15T10:30:00Z"
  }
}`}
          </code>
        </pre>
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          3. Authentication Methods
        </h2>
        <p className="text-muted-foreground">
          You can authenticate your requests using either of these methods:
        </p>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2">
            Method 1: x-api-key Header (Recommended)
          </h3>
          <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono text-primary block">
            x-api-key: YOUR_API_KEY
          </code>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-semibold text-foreground mb-2">
            Method 2: Authorization Bearer Token
          </h3>
          <code className="text-sm bg-muted px-3 py-1.5 rounded font-mono text-primary block">
            Authorization: Bearer YOUR_API_KEY
          </code>
        </div>
      </section>

      {/* Step 4 */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          4. Rate Limits
        </h2>
        <p className="text-muted-foreground">
          The API has the following rate limits to ensure fair usage:
        </p>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>100 requests per minute per API key</li>
          <li>1000 requests per hour per API key</li>
          <li>Rate limit headers are included in all responses</li>
        </ul>
      </section>

      {/* Next Steps */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">Next Steps</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/docs/resources"
            className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="font-semibold text-foreground">
              Resources API Reference
            </h3>
            <p className="text-muted-foreground text-sm">
              Learn about all available endpoints and parameters
            </p>
          </Link>

          <Link
            href="/docs/examples"
            className="block p-4 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="font-semibold text-foreground">Code Examples</h3>
            <p className="text-muted-foreground text-sm">
              See working examples in your preferred language
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
