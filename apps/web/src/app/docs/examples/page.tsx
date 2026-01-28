"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

const tabs = [
  { id: "sdk", label: "SDK" },
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const examples: Record<string, Record<TabId, string>> = {
  // Discovery API - Public endpoints (no auth required)
  check: {
    sdk: `import { check } from '@x402jobs/sdk'

const score = await check('api.example.com/endpoint')

// {
//   found: true,
//   resource: {
//     name: "server/resource",
//     success_rate: 0.94,
//     calls: 1240,
//     value_processed: "$12.4k",
//     last_called: "2m ago"
//   }
// }`,
    curl: `# Check a resource's reliability score (public, no auth)
curl "https://api.x402.jobs/api/v1/resources/check?url=api.example.com/endpoint"`,
    javascript: `// Check resource reliability (public, no auth required)
const response = await fetch(
  'https://api.x402.jobs/api/v1/resources/check?url=' +
  encodeURIComponent('api.example.com/endpoint')
);

const { found, resource } = await response.json();
if (found) {
  console.log(\`Success rate: \${resource.success_rate * 100}%\`);
  console.log(\`Total calls: \${resource.calls}\`);
}`,
    python: `import requests

# Check resource reliability (public, no auth required)
response = requests.get(
    'https://api.x402.jobs/api/v1/resources/check',
    params={'url': 'api.example.com/endpoint'}
)

data = response.json()
if data['found']:
    print(f"Success rate: {data['resource']['success_rate'] * 100}%")
    print(f"Total calls: {data['resource']['calls']}")`,
  },
  discover: {
    sdk: `import { list } from '@x402jobs/sdk'

const resources = await list({ limit: 10, sort: 'popular' })

// Each resource includes trust scores:
// {
//   name: "server/resource",
//   url: "https://api.example.com/endpoint",
//   success_rate: 0.94,        // 0-1 decimal
//   calls: 1240,
//   value_processed: "$12.4k",
//   last_called: "2m ago",
//   network: "solana",
//   price: "5000000"
// }`,
    curl: `# Browse all resources (public, no auth)
curl "https://api.x402.jobs/api/v1/resources?limit=10&sort=popular"

# Search resources
curl "https://api.x402.jobs/api/v1/resources?search=weather&network=solana"`,
    javascript: `// Browse resources with trust scores (public, no auth)
const response = await fetch(
  'https://api.x402.jobs/api/v1/resources?limit=10&sort=popular'
);

const { resources } = await response.json();

// Filter by reliability (>= 90% success rate)
const reliable = resources.filter(r => r.success_rate >= 0.9);

reliable.forEach(r => {
  console.log(\`\${r.name}: \${r.success_rate * 100}% success, \${r.calls} calls\`);
});`,
    python: `import requests

# Browse resources with trust scores (public, no auth)
response = requests.get(
    'https://api.x402.jobs/api/v1/resources',
    params={'limit': 10, 'sort': 'popular'}
)

data = response.json()

# Filter by reliability (>= 90% success rate)
reliable = [r for r in data['resources'] if r['success_rate'] >= 0.9]

for r in reliable:
    print(f"{r['name']}: {r['success_rate'] * 100}% success, {r['calls']} calls")`,
  },

  // Authenticated API - Requires API key
  create: {
    sdk: `import { create } from '@x402jobs/sdk'

const resource = await create({
  name: 'Weather API',
  description: 'Real-time weather data',
  resource_url: 'https://api.example.com/weather'
})`,
    curl: `# Create a new resource (requires API key)
curl -X POST https://api.x402.jobs/api/v1/resources \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Weather API",
    "description": "Real-time weather data and forecasts",
    "resource_url": "https://api.example.com/weather"
  }'`,
    javascript: `const response = await fetch('https://api.x402.jobs/api/v1/resources', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Weather API',
    description: 'Real-time weather data and forecasts',
    resource_url: 'https://api.example.com/weather'
  })
});

const result = await response.json();
console.log('Created:', result.data);`,
    python: `import requests

response = requests.post(
    'https://api.x402.jobs/api/v1/resources',
    headers={'x-api-key': 'YOUR_API_KEY'},
    json={
        'name': 'Weather API',
        'description': 'Real-time weather data and forecasts',
        'resource_url': 'https://api.example.com/weather'
    }
)

result = response.json()
print(f"Created: {result['data']['id']}")`,
  },
  list: {
    sdk: `import { myResources } from '@x402jobs/sdk'

// List your own resources (requires API key)
const resources = await myResources({ page: 1, limit: 10 })`,
    curl: `# List your resources with pagination (requires API key)
curl "https://api.x402.jobs/api/v1/resources?page=1&limit=10" \\
  -H "x-api-key: YOUR_API_KEY"`,
    javascript: `const response = await fetch(
  'https://api.x402.jobs/api/v1/resources?page=1&limit=10',
  {
    headers: { 'x-api-key': 'YOUR_API_KEY' }
  }
);

const result = await response.json();
console.log('Resources:', result.data);`,
    python: `import requests

response = requests.get(
    'https://api.x402.jobs/api/v1/resources',
    headers={'x-api-key': 'YOUR_API_KEY'},
    params={'page': 1, 'limit': 10}
)

result = response.json()
print(f"Found {len(result['data'])} resources")`,
  },
  update: {
    sdk: `import { update } from '@x402jobs/sdk'

await update('resource-id', {
  description: 'Updated description'
})`,
    curl: `# Update a resource (requires API key)
curl -X PUT https://api.x402.jobs/api/v1/resources/RESOURCE_ID \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"description": "Updated description"}'`,
    javascript: `const response = await fetch(
  \`https://api.x402.jobs/api/v1/resources/\${resourceId}\`,
  {
    method: 'PUT',
    headers: {
      'x-api-key': 'YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ description: 'Updated description' })
  }
);`,
    python: `import requests

response = requests.put(
    f'https://api.x402.jobs/api/v1/resources/{resource_id}',
    headers={'x-api-key': 'YOUR_API_KEY'},
    json={'description': 'Updated description'}
)`,
  },
  delete: {
    sdk: `import { remove } from '@x402jobs/sdk'

await remove('resource-id')`,
    curl: `# Delete a resource (requires API key)
curl -X DELETE https://api.x402.jobs/api/v1/resources/RESOURCE_ID \\
  -H "x-api-key: YOUR_API_KEY"`,
    javascript: `const response = await fetch(
  \`https://api.x402.jobs/api/v1/resources/\${resourceId}\`,
  {
    method: 'DELETE',
    headers: { 'x-api-key': 'YOUR_API_KEY' }
  }
);`,
    python: `import requests

response = requests.delete(
    f'https://api.x402.jobs/api/v1/resources/{resource_id}',
    headers={'x-api-key': 'YOUR_API_KEY'}
)`,
  },
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative">
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto pr-16">
        <code className="text-sm font-mono text-foreground whitespace-pre">
          {code}
        </code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-3 right-3"
        onClick={copyToClipboard}
      >
        {copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export default function ExamplesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("sdk");

  // Load saved tab from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("x402-docs-language");
    if (saved && tabs.some((t) => t.id === saved)) {
      setActiveTab(saved as TabId);
    }
  }, []);

  // Save tab to localStorage
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    localStorage.setItem("x402-docs-language", tab);
  };

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
        <span className="text-muted-foreground">Examples</span>
      </div>

      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Code Examples
        </h1>
        <p className="text-lg text-muted-foreground">
          Ready-to-use code examples for integrating with the x402.jobs API.
        </p>
      </div>

      {/* Language Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SDK Installation */}
      {activeTab === "sdk" && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 mb-8">
          <p className="text-sm text-muted-foreground mb-2">Install the SDK:</p>
          <code className="text-sm font-mono text-foreground">
            npm install @x402jobs/sdk
          </code>
          <a
            href="https://github.com/rawgroundbeef/x402jobs"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Discovery API Examples */}
      <div className="space-y-10">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Discovery API
          </h2>
          <p className="text-muted-foreground mb-6">
            Public endpoints for checking resource reliability. No API key
            required.
          </p>

          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Check Resource Score
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Look up a resource&apos;s reliability score before your agent
                pays.
              </p>
              <CodeBlock code={examples.check[activeTab]} />
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Browse Resources
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Discover x402 resources with real trust scores.
              </p>
              <CodeBlock code={examples.discover[activeTab]} />
            </section>
          </div>
        </div>

        {/* Management API Examples */}
        <div className="pt-8 border-t border-border">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Management API
          </h2>
          <p className="text-muted-foreground mb-6">
            Authenticated endpoints for managing your resources. Requires an API
            key from{" "}
            <Link href="/dashboard/api-keys" className="text-primary">
              your dashboard
            </Link>
            .
          </p>

          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Create a Resource
              </h3>
              <CodeBlock code={examples.create[activeTab]} />
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                List Your Resources
              </h3>
              <CodeBlock code={examples.list[activeTab]} />
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Update a Resource
              </h3>
              <CodeBlock code={examples.update[activeTab]} />
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Delete a Resource
              </h3>
              <CodeBlock code={examples.delete[activeTab]} />
            </section>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="border-t border-border pt-8">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Need Help?
        </h2>
        <p className="text-muted-foreground mb-4">
          Can&apos;t find the example you&apos;re looking for? Check out our
          other resources:
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://github.com/rawgroundbeef/x402jobs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          >
            SDK on GitHub <ExternalLink className="h-3 w-3" />
          </a>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/docs/getting-started"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Getting Started
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/docs/resources"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            API Reference
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/docs/errors"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            Error Handling
          </Link>
        </div>
      </div>
    </div>
  );
}
