"use client";

import { useState } from "react";
import { TestResult } from "./EndpointTester";

interface ResponsePreviewProps {
  result: TestResult | null;
}

interface X402Accept {
  scheme: string;
  network: string;
  maxAmountRequired?: string; // v1
  amount?: string; // v2
  asset: string;
  payTo: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

interface X402Resource {
  url: string;
  description?: string;
  mimeType?: string;
}

interface X402Service {
  name: string;
  description?: string;
  website?: string;
}

interface X402Response {
  x402Version?: number;
  error?: string;
  accepts?: X402Accept[];
  resource?: X402Resource; // v2
  service?: X402Service; // v2
}

export default function ResponsePreview({ result }: ResponsePreviewProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result) return null;

  const is402 = result.statusCode === 402;
  const x402Data =
    is402 && result.isJson ? (result.body as X402Response) : null;

  // Format amount from micro units to human readable
  const formatAmount = (microAmount: string) => {
    const amount = parseInt(microAmount, 10);
    if (isNaN(amount)) return microAmount;

    // USDC has 6 decimals
    const usdcAmount = amount / 1_000_000;
    return `$${usdcAmount.toFixed(usdcAmount < 0.01 ? 6 : 2)} USDC`;
  };

  // Truncate address for display
  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              is402
                ? "bg-green-500/10 text-green-500"
                : result.statusCode >= 500
                  ? "bg-destructive/10 text-destructive"
                  : result.statusCode >= 400
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-blue-500/10 text-blue-500"
            }`}
          >
            {result.statusCode} {result.statusText || ""}
          </div>
          <span className="text-sm text-muted-foreground">
            {result.responseTime}ms
          </span>
        </div>

        {result.isJson && (
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-sm text-primary hover:underline"
          >
            {showRaw ? "Show Preview" : "Show Raw JSON"}
          </button>
        )}
      </div>

      {/* Raw JSON View */}
      {showRaw && result.body !== undefined ? (
        <div className="p-4 bg-card border border-border rounded-lg overflow-x-auto">
          <pre className="text-sm font-mono whitespace-pre-wrap">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Visual Preview for 402 responses */}
      {!showRaw && is402 && x402Data ? (
        <div className="space-y-4">
          {/* x402 Version */}
          {x402Data.x402Version && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">x402 Version:</span>
              <span className="font-mono">{x402Data.x402Version}</span>
            </div>
          )}

          {/* v2 Service info */}
          {x402Data.service && (
            <div className="p-3 border border-border rounded-lg bg-card">
              <div className="font-medium">{x402Data.service.name}</div>
              {x402Data.service.description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {x402Data.service.description}
                </div>
              )}
              {x402Data.service.website && (
                <a
                  href={x402Data.service.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-1 inline-block"
                >
                  {x402Data.service.website}
                </a>
              )}
            </div>
          )}

          {/* v2 Resource info */}
          {x402Data.resource && (
            <div className="text-sm">
              <span className="text-muted-foreground">Resource: </span>
              <span className="font-mono">{x402Data.resource.url}</span>
              {x402Data.resource.description && (
                <span className="text-muted-foreground ml-2">
                  — {x402Data.resource.description}
                </span>
              )}
            </div>
          )}

          {/* Payment Options */}
          {x402Data.accepts && x402Data.accepts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                Payment Options ({x402Data.accepts.length})
              </h4>

              {x402Data.accepts.map((accept, index) => (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg bg-card"
                >
                  {/* Header with amount and network */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-semibold">
                        {formatAmount(
                          accept.maxAmountRequired || accept.amount || "0",
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-500/10 text-purple-500 capitalize">
                          {accept.network}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">
                          {accept.scheme}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Pay To:</span>
                      <div className="font-mono break-all">{accept.payTo}</div>
                    </div>

                    <div>
                      <span className="text-muted-foreground">Asset:</span>
                      <div className="font-mono break-all text-xs">
                        {truncateAddress(accept.asset)}
                      </div>
                    </div>

                    {accept.description && (
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">
                          Description:
                        </span>
                        <div>{accept.description}</div>
                      </div>
                    )}

                    {accept.resource && (
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">Resource:</span>
                        <div className="font-mono text-xs break-all">
                          {accept.resource}
                        </div>
                      </div>
                    )}

                    {accept.mimeType && (
                      <div>
                        <span className="text-muted-foreground">
                          MIME Type:
                        </span>
                        <div className="font-mono">{accept.mimeType}</div>
                      </div>
                    )}

                    {accept.maxTimeoutSeconds && (
                      <div>
                        <span className="text-muted-foreground">Timeout:</span>
                        <div>{accept.maxTimeoutSeconds}s</div>
                      </div>
                    )}

                    {accept.extra && Object.keys(accept.extra).length > 0 && (
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">Extra:</span>
                        <div className="font-mono text-xs bg-muted p-2 rounded mt-1">
                          {JSON.stringify(accept.extra, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Non-402 Response Body */}
      {!showRaw && !is402 && result.body !== undefined ? (
        <div className="p-4 bg-card border border-border rounded-lg overflow-x-auto">
          <pre className="text-sm font-mono whitespace-pre-wrap">
            {typeof result.body === "string"
              ? result.body
              : JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Error message if no body */}
      {result.error ? (
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
          <p className="text-sm text-destructive">{result.error}</p>
        </div>
      ) : null}
    </div>
  );
}
