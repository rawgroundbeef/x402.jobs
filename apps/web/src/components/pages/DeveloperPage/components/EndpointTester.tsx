"use client";

import { useState } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { Loader2 } from "lucide-react";

interface EndpointTesterProps {
  onTestComplete: (result: TestResult) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export interface TestResult {
  success: boolean;
  statusCode: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  responseTime: number;
  isJson?: boolean;
  error?: string;
}

export default function EndpointTester({
  onTestComplete,
  isLoading,
  setIsLoading,
}: EndpointTesterProps) {
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:") {
        setError("Only HTTPS URLs are supported");
        return;
      }
    } catch {
      setError(
        "Please enter a valid URL (e.g., https://api.example.com/x402/resource)",
      );
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/test-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          method,
        }),
      });

      const result = await response.json();
      onTestComplete(result);
    } catch (err: unknown) {
      const error = err as Error;
      onTestComplete({
        success: false,
        statusCode: 0,
        responseTime: 0,
        error: error.message || "Failed to test endpoint",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Test Endpoint</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your x402 endpoint URL to test if it returns a proper 402
          response with payment requirements.
        </p>
      </div>

      <div className="flex gap-2">
        <Select
          value={method}
          onChange={(value) => setMethod(value as "GET" | "POST")}
          options={[
            { value: "GET", label: "GET" },
            { value: "POST", label: "POST" },
          ]}
          className="w-24"
        />

        <Input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://api.example.com/x402/solana/myagent"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isLoading) {
              handleTest();
            }
          }}
        />

        <Button onClick={handleTest} disabled={isLoading || !url.trim()}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </span>
          ) : (
            "Test Endpoint"
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
