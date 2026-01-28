"use client";

import { Check, X, Minus } from "lucide-react";
import { TestResult } from "./EndpointTester";

interface SchemaValidatorProps {
  result: TestResult | null;
}

interface ValidationCheck {
  name: string;
  description: string;
  passed: boolean;
  required: boolean;
}

interface X402Accept {
  scheme?: string;
  network?: string;
  maxAmountRequired?: string;
  asset?: string;
  payTo?: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

interface X402Body {
  x402Version?: number;
  accepts?: X402Accept[];
}

export default function SchemaValidator({ result }: SchemaValidatorProps) {
  if (!result) return null;

  const is402 = result.statusCode === 402;
  const body = result.body as X402Body | undefined;

  // Run validation checks
  const checks: ValidationCheck[] = [];

  // Check 1: Returns 402 status
  checks.push({
    name: "HTTP 402 Status",
    description: "Endpoint returns 402 Payment Required",
    passed: is402,
    required: true,
  });

  // Check 2: Response is JSON
  checks.push({
    name: "JSON Response",
    description: "Response body is valid JSON",
    passed: result.isJson === true,
    required: true,
  });

  if (result.isJson && body) {
    // Check 3: Has x402Version
    checks.push({
      name: "x402Version Field",
      description: "Response includes x402Version field",
      passed: typeof body.x402Version === "number",
      required: true,
    });

    // Check 4: Has accepts array
    checks.push({
      name: "accepts Array",
      description: "Response includes accepts array with payment options",
      passed: Array.isArray(body.accepts) && body.accepts.length > 0,
      required: true,
    });

    // If accepts array exists, validate each accept object
    if (Array.isArray(body.accepts) && body.accepts.length > 0) {
      const firstAccept = body.accepts[0];

      // Check 5: scheme field
      checks.push({
        name: "scheme Field",
        description: 'Payment scheme (e.g., "exact")',
        passed:
          typeof firstAccept.scheme === "string" &&
          firstAccept.scheme.length > 0,
        required: true,
      });

      // Check 6: network field
      checks.push({
        name: "network Field",
        description: 'Blockchain network (e.g., "solana", "base")',
        passed:
          typeof firstAccept.network === "string" &&
          firstAccept.network.length > 0,
        required: true,
      });

      // Check 7: maxAmountRequired field
      checks.push({
        name: "maxAmountRequired Field",
        description: "Payment amount in smallest units",
        passed:
          typeof firstAccept.maxAmountRequired === "string" &&
          firstAccept.maxAmountRequired.length > 0,
        required: true,
      });

      // Check 8: asset field
      checks.push({
        name: "asset Field",
        description: "Token address (e.g., USDC contract)",
        passed:
          typeof firstAccept.asset === "string" && firstAccept.asset.length > 0,
        required: true,
      });

      // Check 9: payTo field
      checks.push({
        name: "payTo Field",
        description: "Recipient wallet address",
        passed:
          typeof firstAccept.payTo === "string" && firstAccept.payTo.length > 0,
        required: true,
      });

      // Check 10: resource field
      checks.push({
        name: "resource Field",
        description: "Resource URL being paid for",
        passed:
          typeof firstAccept.resource === "string" &&
          firstAccept.resource.length > 0,
        required: true,
      });

      // Optional fields
      checks.push({
        name: "description Field",
        description: "Human-readable description of the resource",
        passed:
          typeof firstAccept.description === "string" &&
          firstAccept.description.length > 0,
        required: false,
      });

      checks.push({
        name: "mimeType Field",
        description: "Content type of the response",
        passed:
          typeof firstAccept.mimeType === "string" &&
          firstAccept.mimeType.length > 0,
        required: false,
      });

      checks.push({
        name: "maxTimeoutSeconds Field",
        description: "Maximum time allowed for payment",
        passed: typeof firstAccept.maxTimeoutSeconds === "number",
        required: false,
      });
    }
  }

  const requiredChecks = checks.filter((c) => c.required);
  const optionalChecks = checks.filter((c) => !c.required);
  const passedRequired = requiredChecks.filter((c) => c.passed).length;
  const passedOptional = optionalChecks.filter((c) => c.passed).length;
  const allRequiredPassed = passedRequired === requiredChecks.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Schema Validation</h3>
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            allRequiredPassed
              ? "bg-green-500/10 text-green-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {allRequiredPassed ? "Valid x402 Response" : "Invalid x402 Response"}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {passedRequired}/{requiredChecks.length} required checks passed
        {optionalChecks.length > 0 && (
          <span className="ml-2">
            • {passedOptional}/{optionalChecks.length} optional
          </span>
        )}
      </div>

      {/* Required Checks */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          Required Fields
        </h4>
        <div className="space-y-1">
          {requiredChecks.map((check, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  check.passed
                    ? "bg-green-500/20 text-green-500"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                {check.passed ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{check.name}</div>
                <div className="text-xs text-muted-foreground">
                  {check.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional Checks */}
      {optionalChecks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Optional Fields
          </h4>
          <div className="space-y-1">
            {optionalChecks.map((check, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    check.passed
                      ? "bg-green-500/20 text-green-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {check.passed ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{check.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {check.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
