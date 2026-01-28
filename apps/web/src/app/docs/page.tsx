"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@x402jobs/ui/button";
import { Check, Copy } from "lucide-react";

const CURL_EXAMPLE = `# List your resources
curl https://api.x402.jobs/api/v1/resources \\
  -H "x-api-key: your_api_key"`;

export default function DocsPage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(CURL_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Build with x402.jobs
        </h1>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto text-lg">
          Programmatically add and manage resources on the platform. Perfect for
          integrating with your existing platforms and automating resource
          submissions.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button as={Link} href="/dashboard/api-keys" size="lg">
            Get API Key
          </Button>
          <Button
            as={Link}
            href="/docs/getting-started"
            variant="outline"
            size="lg"
          >
            Read the Docs
          </Button>
        </div>
      </div>

      {/* Quick Start Section */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">
          Quick Start
        </h2>

        <div className="bg-muted rounded-lg p-4 mb-4 relative">
          <pre className="text-sm font-mono overflow-x-auto text-foreground pr-16">
            <code>{CURL_EXAMPLE}</code>
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

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm text-muted-foreground">
          <div>
            <span className="text-muted-foreground">Base URL:</span>{" "}
            <code className="text-primary">https://api.x402.jobs/api/v1</code>
          </div>
          <div>
            <span className="text-muted-foreground">Header:</span>{" "}
            <code className="text-primary">x-api-key</code>
          </div>
        </div>
      </section>

      {/* Guides Grid */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Guides</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/docs/resources"
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Resources API
            </h3>
            <p className="text-muted-foreground text-sm">
              Create, read, update, and delete resources programmatically.
            </p>
          </Link>

          <Link
            href="/docs/examples"
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Code Examples
            </h3>
            <p className="text-muted-foreground text-sm">
              Ready-to-use snippets in JavaScript, Python, and curl.
            </p>
          </Link>

          <Link
            href="/developer"
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              x402 Validator
            </h3>
            <p className="text-muted-foreground text-sm">
              Test and validate your x402 endpoints for compliance.
            </p>
          </Link>

          <Link
            href="/docs/long-running-resources"
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Long Running Resources
            </h3>
            <p className="text-muted-foreground text-sm">
              Async operations for image generation, video processing, and more.
            </p>
          </Link>

          <Link
            href="/docs/errors"
            className="block p-6 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-all"
          >
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Error Handling
            </h3>
            <p className="text-muted-foreground text-sm">
              Understand error responses and handle them gracefully.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
