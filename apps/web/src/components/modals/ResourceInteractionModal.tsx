"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Switch } from "@x402jobs/ui/switch";
import { Select } from "@x402jobs/ui/select";
import {
  X,
  Loader2,
  Send,
  Box,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Copy,
  Check,
  LogIn,
  Server,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice, formatResourcePath } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { z } from "zod";
import { ImageUrlOrUpload } from "@/components/inputs";
import { AnimatedDialog, AnimatedDialogContent } from "@x402jobs/ui/dialog";

// Solana logo SVG
function SolanaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="currentColor">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

interface BodyField {
  type?: string;
  required?: boolean;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
  items?: { type: string };
  // Allow nested fields - keys that aren't meta properties are child fields
  [key: string]:
    | BodyField
    | string
    | number
    | boolean
    | string[]
    | { type: string }
    | undefined;
}

// Keys that are metadata, not child fields
const META_KEYS = new Set([
  "type",
  "required",
  "description",
  "default",
  "enum",
  "items",
]);

// Check if a field has nested child fields (is an object with sub-fields)
function hasNestedFields(field: BodyField): boolean {
  return Object.keys(field).some((key) => !META_KEYS.has(key));
}

// Get child fields from a parent field
function getChildFields(field: BodyField): Record<string, BodyField> {
  const children: Record<string, BodyField> = {};
  for (const [key, value] of Object.entries(field)) {
    if (!META_KEYS.has(key) && typeof value === "object" && value !== null) {
      children[key] = value as BodyField;
    }
  }
  return children;
}

// Helper to find field definition by dot-path
function findFieldDef(
  fieldDefs: Record<string, BodyField>,
  path: string,
): BodyField | undefined {
  const parts = path.split(".");
  let current: Record<string, BodyField> = fieldDefs;
  let field: BodyField | undefined;

  for (const part of parts) {
    field = current[part];
    if (!field) return undefined;
    if (hasNestedFields(field)) {
      current = getChildFields(field);
    }
  }

  return field;
}

// Convert flat dot-notation formData to nested object
function buildNestedObject(
  formData: Record<string, string>,
  fieldDefs: Record<string, BodyField>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(formData)) {
    if (value === "" || value === undefined) continue;

    const parts = path.split(".");
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        // Check if next part is a number (array index)
        const nextPart = parts[i + 1];
        if (/^\d+$/.test(nextPart)) {
          current[part] = [];
        } else {
          current[part] = {};
        }
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];

    // Check if this field is an array type - split by newlines
    const fieldDef = findFieldDef(fieldDefs, path);
    let finalValue: unknown = value;
    if (fieldDef?.type === "array" && typeof value === "string") {
      finalValue = value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    // Handle array indices
    if (/^\d+$/.test(lastPart)) {
      const idx = parseInt(lastPart, 10);
      if (!Array.isArray(current)) {
        current[lastPart] = finalValue;
      } else {
        current[idx] = finalValue;
      }
    } else {
      current[lastPart] = finalValue;
    }
  }

  return result;
}

// Get smart default for a field based on name and type
function getSmartDefault(
  fieldName: string,
  field: BodyField,
): string | undefined {
  const lowerName = fieldName.toLowerCase();

  // JSON-RPC version
  if (lowerName === "jsonrpc") {
    return "2.0";
  }

  // Auto-generate UUIDs for ID fields
  if (
    lowerName === "id" ||
    lowerName === "message_id" ||
    lowerName === "messageid" ||
    lowerName.endsWith("_id")
  ) {
    return crypto.randomUUID();
  }

  // Default role to user
  if (lowerName === "role") {
    if (field.enum?.includes("ROLE_USER")) return "ROLE_USER";
    if (field.enum?.includes("user")) return "user";
  }

  // Use first enum value as default
  if (field.enum && field.enum.length > 0) {
    return field.enum[0];
  }

  // Use explicit default if provided
  if (field.default !== undefined) {
    return String(field.default);
  }

  return undefined;
}

interface Resource {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  resource_url: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  server_id?: string;
  server_name?: string;
  server_slug?: string;
  is_a2a?: boolean;
  supports_refunds?: boolean;
  output_schema?: {
    input?: {
      type?: string;
      method?: string;
      bodyType?: string;
      bodyFields?: Record<string, BodyField>;
      queryParams?: Record<string, BodyField>;
    };
    output?: Record<string, unknown>;
  };
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    pricing?: {
      amount?: number;
      currency?: string;
    };
    [key: string]: unknown;
  };
}

interface ResourceInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  resource: Resource | null;
  onSubmit?: (
    resource: Resource,
    formData: Record<string, unknown>,
  ) => Promise<void>;
}

export function ResourceInteractionModal({
  isOpen,
  onClose,
  onBack,
  resource,
  onSubmit,
}: ResourceInteractionModalProps) {
  const { user, isAdmin } = useAuth();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [pollSteps, setPollSteps] = useState<
    Array<{ name: string; status: string; sequence: number }>
  >([]);
  const [result, setResult] = useState<{
    response: string;
    fullData: unknown;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<{
    amount: number;
    transaction: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Extract input fields from outputSchema (bodyFields for POST, queryParams for GET)
  const inputFields = useMemo(() => {
    const bodyFields = resource?.output_schema?.input?.bodyFields || {};
    const queryParams = resource?.output_schema?.input?.queryParams || {};
    // Merge both - queryParams take precedence for GET requests
    return { ...bodyFields, ...queryParams };
  }, [resource]);

  // Sort field entries: required fields first, then optional
  const fieldEntries = useMemo(() => {
    return Object.entries(inputFields).sort(([, a], [, b]) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });
  }, [inputFields]);

  // Initialize form with default values when resource changes (recursive for nested fields)
  useEffect(() => {
    if (!resource) return;

    const defaults: Record<string, string> = {};

    // Recursively collect defaults from nested fields
    const collectDefaults = (
      fields: Record<string, BodyField>,
      parentPath: string = "",
    ) => {
      for (const [fieldName, field] of Object.entries(fields)) {
        const path = parentPath ? `${parentPath}.${fieldName}` : fieldName;

        // Check for smart defaults first, then explicit defaults
        const smartDefault = getSmartDefault(fieldName, field);
        if (smartDefault !== undefined) {
          defaults[path] = smartDefault;
        }

        // Recurse into nested fields
        if (hasNestedFields(field)) {
          collectDefaults(getChildFields(field), path);
        }
      }
    };

    collectDefaults(inputFields);

    if (Object.keys(defaults).length > 0) {
      setFormData(defaults);
    }
  }, [resource, inputFields]);

  // Build dynamic Zod schema from input fields
  const formSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [fieldName, field] of fieldEntries) {
      let fieldSchema: z.ZodTypeAny;

      switch (field.type) {
        case "number":
          fieldSchema = z.string().transform((val) => {
            if (!val) return undefined;
            const num = parseFloat(val);
            if (isNaN(num)) throw new Error("Must be a number");
            return num;
          });
          break;
        case "integer":
          fieldSchema = z.string().transform((val) => {
            if (!val) return undefined;
            const num = parseInt(val, 10);
            if (isNaN(num)) throw new Error("Must be a whole number");
            return num;
          });
          break;
        case "boolean":
          fieldSchema = z.string().transform((val) => {
            if (!val) return undefined;
            return val === "true";
          });
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.required) {
        // For required fields, ensure non-empty
        if (field.type === "string" || !field.type) {
          shape[fieldName] = z.string().min(1, `${fieldName} is required`);
        } else {
          shape[fieldName] = fieldSchema.refine(
            (val) => val !== undefined && val !== "",
            { message: `${fieldName} is required` },
          );
        }
      } else {
        shape[fieldName] = fieldSchema.optional();
      }
    }

    return z.object(shape);
  }, [fieldEntries]);

  // Validate form and return whether it's valid
  const validateForm = useCallback(() => {
    const result = formSchema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0];
        if (typeof fieldName === "string") {
          errors[fieldName] = issue.message;
        }
      }
      setFieldErrors(errors);
      return false;
    }
    setFieldErrors({});
    return true;
  }, [formSchema, formData]);

  // Check if form is valid (for disabling submit button)
  // For now, always allow submission - nested fields make Zod validation complex
  // We'll validate required fields visually instead
  const isFormValid = useMemo(() => {
    // Check that all required top-level fields have values
    for (const [fieldName, field] of Object.entries(inputFields)) {
      if (field.required) {
        const value = formData[fieldName];
        if (!value || value.trim() === "") {
          // Check if it's a nested object - those don't need a direct value
          if (!hasNestedFields(field)) {
            return false;
          }
        }
      }
    }
    return true;
  }, [inputFields, formData]);

  // Format price for display - always use max_amount_required (the authoritative X402 field)
  const priceDisplay = useMemo(() => {
    return formatPrice(resource?.max_amount_required);
  }, [resource]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    // Clear field error when user types
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    if (!resource) return;

    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setPayment(null);
    setPollProgress(null);
    setPollSteps([]);

    try {
      if (onSubmit) {
        await onSubmit(resource, formData);
        return;
      }

      // Build nested request body from flat dot-notation formData
      const transformedBody = buildNestedObject(formData, inputFields);

      // Call the execute API
      const response = await authenticatedFetch("/execute", {
        method: "POST",
        body: JSON.stringify({
          resourceId: resource.id,
          resourceUrl: resource.resource_url,
          method: resource.output_schema?.input?.method || "POST",
          body: transformedBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle insufficient balance specially
        if (
          response.status === 402 &&
          data.required &&
          data.available !== undefined
        ) {
          setError(
            `Insufficient balance: need $${data.required.toFixed(2)} USDC, have $${data.available.toFixed(2)}. Please fund your wallet.`,
          );
        } else {
          setError(data.error || data.details || "Request failed");
        }
        return;
      }

      // Show payment info if paid
      if (data.payment) {
        setPayment({
          amount: data.payment.amountUsdc || data.payment.amount,
          transaction: data.payment.signature || data.payment.transaction,
        });
      }

      // The actual resource response may be nested in data.data (from execute API wrapper)
      const resourceResponse = data.data || data;

      // Check if this is an async response that needs polling
      if (resourceResponse.statusUrl && resourceResponse.runId) {
        setIsPolling(true);
        setPollStatus("Job started...");
        setPollProgress(null);
        setPollSteps([]);

        // Poll for completion
        const pollForResult = async () => {
          const retryAfter = resourceResponse.retryAfterSeconds || 2;
          let attempts = 0;
          const maxAttempts = 150; // 5 minutes max at 2 seconds per poll

          while (attempts < maxAttempts) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000),
            );
            attempts++;

            try {
              const statusResponse = await fetch(resourceResponse.statusUrl);
              const statusData = await statusResponse.json();

              // Update progress and steps
              if (statusData.progress) {
                setPollProgress(statusData.progress);
              }
              if (statusData.steps) {
                setPollSteps(statusData.steps);
              }

              // Check state (API returns: pending, processing, succeeded, failed)
              if (statusData.state === "succeeded") {
                setIsPolling(false);
                setPollStatus(null);
                setIsSubmitting(false);

                // Extract the result
                const resultData =
                  statusData.response ||
                  statusData.result ||
                  statusData.output ||
                  statusData;
                let displayText: string;
                if (typeof resultData === "string") {
                  displayText = resultData;
                } else if (resultData?.response) {
                  displayText = String(resultData.response);
                } else {
                  displayText = JSON.stringify(resultData, null, 2);
                }

                setResult({
                  response: displayText,
                  fullData: resultData,
                });
                return;
              } else if (statusData.state === "failed") {
                setIsPolling(false);
                setPollStatus(null);
                setIsSubmitting(false);
                setError(statusData.error || "Job failed");
                return;
              } else {
                // Still running - update status message
                const progress = statusData.progress;
                if (progress?.total > 0) {
                  setPollStatus(
                    `Running step ${progress.completed + 1} of ${progress.total}...`,
                  );
                } else {
                  setPollStatus(`Running... (${attempts * retryAfter}s)`);
                }
              }
            } catch (pollError) {
              console.error("Poll error:", pollError);
              // Continue polling on error
            }
          }

          // Timeout
          setIsPolling(false);
          setPollStatus(null);
          setPollProgress(null);
          setPollSteps([]);
          setIsSubmitting(false);
          setError("Job timed out after 5 minutes");
        };

        pollForResult();
        // Don't set isSubmitting to false yet - we're still waiting
        return;
      }

      // Extract response from data (synchronous response)
      const responseData = resourceResponse.response || resourceResponse;

      // Try to extract just the "response" key if it exists
      let displayText: string;
      if (
        typeof responseData === "object" &&
        responseData !== null &&
        "response" in responseData
      ) {
        displayText = String(responseData.response);
      } else if (typeof responseData === "string") {
        displayText = responseData;
      } else {
        displayText = JSON.stringify(responseData, null, 2);
      }

      setResult({
        response: displayText,
        fullData: responseData,
      });
      setIsSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setFieldErrors({});
    setResult(null);
    setError(null);
    setPayment(null);
    setCopied(false);
    setIsPolling(false);
    setPollStatus(null);
    onClose();
  };

  const handleBack = () => {
    setFormData({});
    setFieldErrors({});
    setResult(null);
    setError(null);
    setPayment(null);
    setCopied(false);
    setIsPolling(false);
    setPollStatus(null);
    onBack?.();
  };

  const handleDelete = async () => {
    if (!resource || !isAdmin) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${resource.name}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(`/resources/${resource.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete resource");
      }

      // Refresh the page to show updated list
      window.location.reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete resource",
      );
      setIsDeleting(false);
    }
  };

  if (!resource) return null;

  // Avatar: use avatar_url, then extra.avatarUrl as fallbacks
  const avatarUrl = resource.avatar_url || resource.extra?.avatarUrl;

  // Parse URL for display (matches ResourceCard format)
  const urlInfo = (() => {
    try {
      const url = new URL(resource.resource_url);
      return {
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
        pathname: url.pathname,
      };
    } catch {
      return { protocol: "", hostname: "", pathname: resource.resource_url };
    }
  })();

  // Display name: prefer server_slug/slug format, fall back to URL parsing, then names
  const displayName = (() => {
    // First try the standard slug format
    const pathFromSlugs = formatResourcePath(resource);
    if (pathFromSlugs) {
      return pathFromSlugs;
    }

    // Try to parse from URL: https://x402factory.ai/solana/note -> x402factory-ai/note
    try {
      const url = new URL(resource.resource_url);
      const hostname = url.hostname.replace(/\./g, "-"); // x402factory.ai -> x402factory-ai
      const pathParts = url.pathname.split("/").filter(Boolean);
      const resourceSlug = pathParts[pathParts.length - 1]; // Last path segment
      if (hostname && resourceSlug) {
        return `${hostname}/${resourceSlug}`;
      }
    } catch {
      // URL parsing failed
    }

    return (
      resource.extra?.agentName || resource.extra?.serviceName || resource.name
    );
  })();

  return (
    <AnimatedDialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <AnimatedDialogContent
        className="max-w-2xl p-0 gap-0 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col"
        showClose={false}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start gap-3">
            {/* Back button */}
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="flex-shrink-0 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Box className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold truncate">{displayName}</h2>
              <p
                className="text-xs text-muted-foreground font-mono truncate mt-0.5"
                title={resource.resource_url}
              >
                <span
                  className={
                    urlInfo.protocol === "http"
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  }
                >
                  {urlInfo.protocol}://
                </span>
                {urlInfo.hostname}
                {urlInfo.pathname}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {resource.server_id && (
                <Link
                  href={`/servers/${resource.server_slug || resource.server_id}`}
                  onClick={handleClose}
                  title={
                    resource.server_slug ||
                    resource.server_name ||
                    "View Server"
                  }
                >
                  <Button variant="ghost" size="icon-sm">
                    <Server className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete resource (admin)"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description - full width at bottom */}
          {resource.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              {resource.description}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4">
          {/* A2A Badge Header */}
          {resource.is_a2a && (
            <div className="flex items-center gap-2 p-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30">
                A2A
              </span>
              <span className="text-sm text-muted-foreground">
                Agent-to-Agent Protocol
              </span>
            </div>
          )}

          {/* Refund Badge Header */}
          {resource.supports_refunds && (
            <div className="flex flex-col items-center gap-1">
              <a
                href="https://openfacilitator.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/badges/refund-protected.svg"
                  alt="Refund Protected"
                  className="h-8"
                />
              </a>
              <span className="text-xs text-muted-foreground">
                Powered by{" "}
                <a
                  href="https://openfacilitator.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 underline underline-offset-2"
                >
                  OpenFacilitator.io
                </a>
              </span>
            </div>
          )}

          {/* Dynamic Form Fields - Recursive Renderer */}
          {fieldEntries.length > 0 ? (
            <div className="space-y-4">
              {(() => {
                const MAX_DEPTH = 4;

                // Format type for display
                const formatType = (type?: string) => {
                  switch (type) {
                    case "string":
                      return "text";
                    case "integer":
                      return "whole number";
                    case "number":
                      return "number";
                    case "boolean":
                      return "true/false";
                    case "array":
                      return "list";
                    case "object":
                      return "object";
                    default:
                      return type || "text";
                  }
                };

                // Render a single primitive field
                const renderPrimitiveField = (
                  fieldName: string,
                  field: BodyField,
                  path: string,
                ) => {
                  const hasError = !!fieldErrors[path];

                  return (
                    <div key={path} className="space-y-1.5">
                      {/* Hide label for boolean fields */}
                      {field.type !== "boolean" && (
                        <Label
                          htmlFor={path}
                          className="flex items-center gap-1.5"
                        >
                          <span className="capitalize">
                            {fieldName
                              .replace(/([A-Z])/g, " $1")
                              .replace(/_/g, " ")
                              .trim()}
                          </span>
                          {field.required && (
                            <span className="text-destructive">*</span>
                          )}
                          <span className="text-xs text-muted-foreground font-normal normal-case">
                            ({formatType(field.type)}
                            {!field.required && ", optional"})
                          </span>
                        </Label>
                      )}

                      {field.enum ? (
                        <Select
                          id={path}
                          value={formData[path] || ""}
                          onChange={(value) => handleFieldChange(path, value)}
                          placeholder="Select..."
                          options={field.enum.map((opt) => ({
                            value: opt,
                            label: opt,
                          }))}
                          className={hasError ? "border-destructive" : ""}
                        />
                      ) : field.type === "boolean" ? (
                        <div className="flex items-center justify-between py-1">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium capitalize">
                              {fieldName
                                .replace(/([A-Z])/g, " $1")
                                .replace(/_/g, " ")
                                .trim()}
                              {field.required && (
                                <span className="text-destructive ml-1">*</span>
                              )}
                            </span>
                            {field.description && (
                              <span className="text-xs text-muted-foreground">
                                {field.description}
                              </span>
                            )}
                          </div>
                          <Switch
                            checked={formData[path] === "true"}
                            onCheckedChange={(checked) =>
                              handleFieldChange(
                                path,
                                checked ? "true" : "false",
                              )
                            }
                          />
                        </div>
                      ) : field.type === "array" ? (
                        <div className="space-y-1">
                          <textarea
                            id={path}
                            placeholder={
                              field.description ||
                              `Enter ${fieldName} (one per line)...`
                            }
                            value={formData[path] || ""}
                            onChange={(e) =>
                              handleFieldChange(path, e.target.value)
                            }
                            rows={3}
                            className={`w-full px-3 py-2 text-sm rounded-md border bg-background resize-y min-h-[80px] ${
                              hasError
                                ? "border-destructive"
                                : "border-input focus:border-ring"
                            } focus:outline-none focus:ring-1 focus:ring-ring`}
                          />
                          <p className="text-xs text-muted-foreground">
                            Enter one value per line
                          </p>
                        </div>
                      ) : field.type === "file" ? (
                        <ImageUrlOrUpload
                          value={formData[path] || ""}
                          onChange={(value) => handleFieldChange(path, value)}
                          placeholder={
                            field.description ||
                            `Upload or enter URL for ${fieldName}...`
                          }
                          hasError={hasError}
                        />
                      ) : (
                        <Input
                          id={path}
                          type={
                            field.type === "number" || field.type === "integer"
                              ? "number"
                              : "text"
                          }
                          placeholder={
                            field.description || `Enter ${fieldName}...`
                          }
                          value={formData[path] || ""}
                          onChange={(e) =>
                            handleFieldChange(path, e.target.value)
                          }
                          className={hasError ? "border-destructive" : ""}
                        />
                      )}

                      {hasError && (
                        <p className="text-xs text-destructive">
                          {fieldErrors[path]}
                        </p>
                      )}
                    </div>
                  );
                };

                // Recursive field renderer
                const renderFields = (
                  fields: Record<string, BodyField>,
                  parentPath: string = "",
                  depth: number = 0,
                ): React.ReactNode[] => {
                  if (depth >= MAX_DEPTH) {
                    // Fallback: JSON textarea for deeply nested content
                    return [
                      <div key={parentPath} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {parentPath} (JSON)
                        </Label>
                        <textarea
                          placeholder="Enter JSON..."
                          value={formData[parentPath] || ""}
                          onChange={(e) =>
                            handleFieldChange(parentPath, e.target.value)
                          }
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background resize-y min-h-[80px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>,
                    ];
                  }

                  // Sort: required first
                  const sortedEntries = Object.entries(fields).sort(
                    ([, a], [, b]) => {
                      if (a.required && !b.required) return -1;
                      if (!a.required && b.required) return 1;
                      return 0;
                    },
                  );

                  return sortedEntries.map(([fieldName, field]) => {
                    const path = parentPath
                      ? `${parentPath}.${fieldName}`
                      : fieldName;

                    // Check if this field has nested children
                    if (hasNestedFields(field)) {
                      const children = getChildFields(field);
                      return (
                        <div
                          key={path}
                          className={`space-y-3 ${
                            depth > 0 ? "pl-4 border-l-2 border-border/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold capitalize text-foreground">
                              {fieldName
                                .replace(/([A-Z])/g, " $1")
                                .replace(/_/g, " ")
                                .trim()}
                            </span>
                            {field.required && (
                              <span className="text-destructive text-xs">
                                *
                              </span>
                            )}
                          </div>
                          {renderFields(children, path, depth + 1)}
                        </div>
                      );
                    }

                    // Render as primitive field
                    return renderPrimitiveField(fieldName, field, path);
                  });
                };

                return renderFields(inputFields);
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>This resource has no input fields</p>
              <p className="text-sm mt-1">Just click submit to execute</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {/* Show failed step info if available */}
              {pollSteps.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground mb-1.5">
                    Failed at step:
                  </p>
                  {pollSteps
                    .filter((s) => s.status === "failed")
                    .map((step) => (
                      <div
                        key={step.sequence}
                        className="flex items-center gap-2 text-destructive"
                      >
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>{step.name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Success */}
          {payment && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <div>
                <span className="font-medium">
                  Paid ${payment.amount.toFixed(2)} USDC
                </span>
                <a
                  href={`https://solscan.io/tx/${payment.transaction}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline text-xs"
                >
                  View tx
                </a>
              </div>
            </div>
          )}

          {/* Job Progress (while polling) */}
          {isPolling && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
              {/* Progress bar */}
              {pollProgress && pollProgress.total > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Running workflow...
                    </span>
                    <span className="font-medium">
                      {pollProgress.completed}/{pollProgress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{
                        width: `${(pollProgress.completed / pollProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{pollStatus || "Starting job..."}</span>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Response</Label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.response);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              {/* Check if response looks like JSON */}
              {(() => {
                const trimmed = result.response.trim();
                const looksLikeJson =
                  trimmed.startsWith("{") || trimmed.startsWith("[");

                if (looksLikeJson) {
                  // Render as formatted JSON
                  try {
                    const parsed = JSON.parse(trimmed);
                    return (
                      <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto overflow-y-auto max-h-64 font-mono whitespace-pre-wrap break-words">
                        {JSON.stringify(parsed, null, 2)}
                      </pre>
                    );
                  } catch {
                    // Not valid JSON, render as markdown
                    return (
                      <div className="p-4 bg-muted rounded-lg prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-blockquote:my-2 prose-pre:my-2 prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background/50 prose-pre:p-3">
                        <ReactMarkdown>{result.response}</ReactMarkdown>
                      </div>
                    );
                  }
                } else {
                  // Render as markdown for text responses
                  return (
                    <div className="p-4 bg-muted rounded-lg prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-blockquote:my-2 prose-pre:my-2 prose-code:bg-background/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-background/50 prose-pre:p-3">
                      <ReactMarkdown>{result.response}</ReactMarkdown>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-end gap-1.5 mb-3 text-sm">
            <span className="font-semibold">{priceDisplay} USDC</span>
            {resource.network === "solana" && (
              <SolanaIcon className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>

          {user ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isPolling || !isFormValid}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : isPolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {pollStatus || "Waiting..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit & Pay
                </>
              )}
            </Button>
          ) : (
            <Button
              as={Link}
              href="/login"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Sign in to Try
            </Button>
          )}
        </div>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
