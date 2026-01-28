"use client";

import { useState } from "react";
import BaseLayout from "@/components/BaseLayout";
import { Card, CardContent } from "@x402jobs/ui/card";
import {
  EndpointTester,
  ResponsePreview,
  SchemaValidator,
  DebugHelper,
  TestResult,
} from "./components";

export default function DeveloperPage() {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestComplete = (result: TestResult) => {
    setTestResult(result);
  };

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <div className="py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">x402 Validator</h1>
          <p className="text-lg text-muted-foreground">
            Test and validate your x402 endpoints to ensure they comply with the
            x402 specification.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Endpoint Tester Card */}
          <Card>
            <CardContent className="p-6">
              <EndpointTester
                onTestComplete={handleTestComplete}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </CardContent>
          </Card>

          {/* Results Section */}
          {testResult && (
            <>
              {/* Debug Helper - Shows diagnostic info */}
              <Card>
                <CardContent className="p-6">
                  <DebugHelper result={testResult} />
                </CardContent>
              </Card>

              {/* Schema Validator */}
              <Card>
                <CardContent className="p-6">
                  <SchemaValidator result={testResult} />
                </CardContent>
              </Card>

              {/* Response Preview */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Response Details
                  </h3>
                  <ResponsePreview result={testResult} />
                </CardContent>
              </Card>
            </>
          )}

          {/* Help Section */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">How x402 Works</h3>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  x402 is a protocol for pay-per-use APIs. When a client makes a
                  request without payment, the server returns HTTP 402 Payment
                  Required with payment options.
                </p>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">
                    Expected Flow:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Client sends request to your x402 endpoint</li>
                    <li>
                      Server returns 402 with payment schema in the response
                      body
                    </li>
                    <li>Client makes payment and gets a payment proof</li>
                    <li>Client retries request with X-PAYMENT header</li>
                    <li>
                      Server validates payment and returns the actual response
                    </li>
                  </ol>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">
                    Required Response Fields:
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        x402Version
                      </code>{" "}
                      - Protocol version (currently 1)
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts
                      </code>{" "}
                      - Array of payment options
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].scheme
                      </code>{" "}
                      - Payment scheme (e.g., "exact")
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].network
                      </code>{" "}
                      - Blockchain network (e.g., "solana", "base")
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].maxAmountRequired
                      </code>{" "}
                      - Amount in smallest units
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].asset
                      </code>{" "}
                      - Token contract address
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].payTo
                      </code>{" "}
                      - Recipient wallet address
                    </li>
                    <li>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        accepts[].resource
                      </code>{" "}
                      - Resource URL
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-500 mb-2">
                    Common Issue: Getting 500 instead of 402
                  </h4>
                  <p className="text-blue-400">
                    If your endpoint returns 500 errors for requests without a
                    body, your server is validating the request body before
                    checking for payment. Move the x402 payment check to happen
                    first in your middleware chain.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </BaseLayout>
  );
}
