"use client";

import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { TestResult } from "./EndpointTester";

interface DebugHelperProps {
  result: TestResult | null;
}

interface ErrorBody {
  error?: string;
}

interface DebugInfo {
  title: string;
  severity: "success" | "warning" | "error" | "info";
  message: string;
  suggestions?: string[];
  codeExample?: string;
}

export default function DebugHelper({ result }: DebugHelperProps) {
  if (!result) return null;

  const getDebugInfo = (): DebugInfo | null => {
    const { statusCode, body, error } = result;

    // Success case - 402
    if (statusCode === 402) {
      return {
        title: "x402 Response Detected",
        severity: "success",
        message:
          "Your endpoint correctly returns HTTP 402 Payment Required. Clients will receive the payment requirements and can proceed with payment.",
        suggestions: [
          "Verify all required fields are present in the response",
          "Test the actual payment flow to ensure payments are processed correctly",
          "Consider adding a description field to help users understand what they're paying for",
        ],
      };
    }

    // Connection error
    if (statusCode === 0) {
      return {
        title: "Connection Failed",
        severity: "error",
        message:
          error ||
          "Could not connect to the endpoint. This might be a network issue or the server is not responding.",
        suggestions: [
          "Check that the URL is correct and the server is running",
          "Ensure the endpoint is publicly accessible (not behind a VPN or firewall)",
          "Verify the server's SSL certificate is valid",
          "Check if the server has CORS configured properly",
        ],
      };
    }

    // 500 errors - most common issue
    if (statusCode >= 500 && statusCode < 600) {
      const typedBody = body as ErrorBody | string | undefined;
      const errorMessage =
        typeof typedBody === "object" && typedBody?.error
          ? typedBody.error
          : typeof typedBody === "string"
            ? typedBody
            : "Internal server error";

      // Check for JSON parsing errors
      if (
        errorMessage.includes("JSON") ||
        errorMessage.includes("token") ||
        errorMessage.includes("parse")
      ) {
        return {
          title: "Request Body Validation Error",
          severity: "error",
          message:
            "The server is trying to validate the request body before checking for x402 payment. This is a common issue with A2A (Agent-to-Agent) endpoints.",
          suggestions: [
            "Move your x402 payment check to happen BEFORE request body validation",
            "Return 402 for any request without a valid X-PAYMENT header, regardless of body",
            "The x402 schema in the 402 response should tell clients what body format to send",
          ],
          codeExample: `// Middleware order should be:
// 1. Check for X-PAYMENT header first
// 2. If no payment, return 402 with payment requirements
// 3. If payment present, validate and process
// 4. THEN validate request body

app.use('/x402/*', (req, res, next) => {
  const payment = req.headers['x-payment'];
  
  if (!payment) {
    // Return 402 before body validation
    return res.status(402).json({
      x402Version: 1,
      error: "Payment required",
      accepts: [{ /* payment options */ }]
    });
  }
  
  // Validate payment, then proceed to body validation
  next();
});`,
        };
      }

      // Check for missing field errors
      if (
        errorMessage.includes("missing") ||
        errorMessage.includes("required") ||
        errorMessage.includes("properties")
      ) {
        return {
          title: "Request Validation Error",
          severity: "error",
          message: `The server is validating request body before x402 check: "${errorMessage}"`,
          suggestions: [
            "The x402 payment check should happen before any request body validation",
            "Unpaid requests should receive 402 without body validation",
            "Only validate the request body after payment is confirmed",
          ],
        };
      }

      // Generic 500
      return {
        title: `Server Error (${statusCode})`,
        severity: "error",
        message: errorMessage,
        suggestions: [
          "Check your server logs for more details",
          "Ensure your x402 middleware is correctly configured",
          "Verify the endpoint handler doesn't throw exceptions",
        ],
      };
    }

    // 404 errors
    if (statusCode === 404) {
      return {
        title: "Endpoint Not Found",
        severity: "error",
        message:
          "The server returned 404, meaning the endpoint path doesn't exist.",
        suggestions: [
          "Double-check the URL path is correct",
          "Verify the agent ID or resource identifier in the URL",
          "Check if the endpoint requires a specific network prefix (e.g., /solana/ or /base/)",
          "Ensure the route is properly registered in your server",
        ],
      };
    }

    // 405 Method Not Allowed
    if (statusCode === 405) {
      return {
        title: "Method Not Allowed",
        severity: "warning",
        message: "The HTTP method used is not supported by this endpoint.",
        suggestions: [
          "Try using a different method (GET vs POST)",
          "x402 endpoints typically respond to both GET and POST",
          "GET usually returns payment requirements only",
          "POST is used for the actual paid interaction",
        ],
      };
    }

    // 401/403 - Auth errors
    if (statusCode === 401 || statusCode === 403) {
      return {
        title: statusCode === 401 ? "Unauthorized" : "Forbidden",
        severity: "warning",
        message:
          "The server requires authentication or denies access. This might conflict with x402.",
        suggestions: [
          "x402 endpoints should return 402 for unauthenticated requests, not 401",
          "Consider if traditional auth is needed alongside x402 payments",
          "Payment validation should happen before auth checks in most cases",
        ],
      };
    }

    // 200 OK - Not an x402 endpoint
    if (statusCode === 200) {
      return {
        title: "Endpoint Returns 200 OK",
        severity: "info",
        message:
          "This endpoint returns success without requiring payment. It may not be configured as an x402 resource.",
        suggestions: [
          "If this should be a paid resource, add x402 middleware",
          "Ensure the x402 payment check runs before the main handler",
          "The endpoint should return 402 when no valid payment is provided",
        ],
      };
    }

    // Other status codes
    return {
      title: `HTTP ${statusCode} Response`,
      severity: "info",
      message: `The endpoint returned status ${statusCode}. For x402, expect status 402 when payment is required.`,
      suggestions: [
        "x402 endpoints should return 402 Payment Required for unpaid requests",
        "Check your server configuration and middleware order",
      ],
    };
  };

  const debugInfo = getDebugInfo();

  if (!debugInfo) return null;

  const severityStyles = {
    success: {
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      icon: "text-green-500",
      title: "text-green-500",
    },
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      icon: "text-yellow-500",
      title: "text-yellow-500",
    },
    error: {
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      icon: "text-destructive",
      title: "text-destructive",
    },
    info: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      icon: "text-blue-500",
      title: "text-blue-500",
    },
  };

  const styles = severityStyles[debugInfo.severity];

  const SeverityIcon = () => {
    const iconClass = `w-5 h-5 ${styles.icon}`;
    switch (debugInfo.severity) {
      case "success":
        return <CheckCircle className={iconClass} />;
      case "warning":
        return <AlertTriangle className={iconClass} />;
      case "error":
        return <XCircle className={iconClass} />;
      default:
        return <Info className={iconClass} />;
    }
  };

  return (
    <div
      className={`rounded-lg border ${styles.bg} ${styles.border} p-4 space-y-3`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <SeverityIcon />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold ${styles.title}`}>
            {debugInfo.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {debugInfo.message}
          </p>
        </div>
      </div>

      {debugInfo.suggestions && debugInfo.suggestions.length > 0 && (
        <div className="ml-8">
          <h4 className="text-sm font-medium mb-2">Suggestions:</h4>
          <ul className="space-y-1">
            {debugInfo.suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="text-sm text-muted-foreground flex items-start gap-2"
              >
                <span className="text-muted-foreground mt-1">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {debugInfo.codeExample && (
        <div className="ml-8 mt-3">
          <h4 className="text-sm font-medium mb-2">Example Fix:</h4>
          <div className="bg-card border border-border rounded-lg p-3 overflow-x-auto">
            <pre className="text-xs font-mono whitespace-pre">
              {debugInfo.codeExample}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
