"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Switch } from "@x402jobs/ui/switch";
import { Select } from "@x402jobs/ui/select";
import {
  Loader2,
  Send,
  Box,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  LogIn,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { authenticatedFetch } from "@/lib/api";
import { formatPrice, formatResourcePath } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { z } from "zod";
import { SlidePanel } from "./SlidePanel";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
import { ImageUrlOrUpload } from "@/components/inputs";

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
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
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

interface ResourceInteractionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource | null;
  onSubmit?: (
    resource: Resource,
    formData: Record<string, unknown>,
  ) => Promise<void>;
}

export function ResourceInteractionPanel({
  isOpen,
  onClose,
  resource,
  onSubmit,
}: ResourceInteractionPanelProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Initialize form with default values when resource changes
  useEffect(() => {
    if (!resource) return;

    const defaults: Record<string, string> = {};
    for (const [fieldName, field] of Object.entries(inputFields)) {
      if (field.default !== undefined) {
        defaults[fieldName] = String(field.default);
      }
    }

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
  const isFormValid = useMemo(() => {
    const result = formSchema.safeParse(formData);
    return result.success;
  }, [formSchema, formData]);

  // Format price for display
  const priceDisplay = useMemo(() => {
    return formatPrice(resource?.max_amount_required);
  }, [resource]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
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

      // Transform form data
      const transformedBody: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        const fieldDef = inputFields[key];
        if (fieldDef?.type === "array" && typeof value === "string") {
          transformedBody[key] = value
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
        } else {
          transformedBody[key] = value;
        }
      }

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

      if (data.payment) {
        setPayment({
          amount: data.payment.amountUsdc || data.payment.amount,
          transaction: data.payment.signature || data.payment.transaction,
        });
      }

      const resourceResponse = data.data || data;

      // Check if this is an async response that needs polling
      // Accept both jobId (documented) and runId (legacy) as identifiers
      const asyncJobId = resourceResponse.jobId || resourceResponse.runId;
      if (resourceResponse.statusUrl && asyncJobId) {
        setIsPolling(true);
        setPollStatus("Job started...");

        const pollForResult = async () => {
          const retryAfter = resourceResponse.retryAfterSeconds || 2;
          let attempts = 0;
          const maxAttempts = 150;

          while (attempts < maxAttempts) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryAfter * 1000),
            );
            attempts++;

            try {
              const statusResponse = await fetch(resourceResponse.statusUrl);
              const statusData = await statusResponse.json();

              if (statusData.progress) {
                setPollProgress(statusData.progress);
              }
              if (statusData.steps) {
                setPollSteps(statusData.steps);
              }

              if (statusData.state === "succeeded") {
                setIsPolling(false);
                setPollStatus(null);
                setIsSubmitting(false);

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
            }
          }

          setIsPolling(false);
          setPollStatus(null);
          setPollProgress(null);
          setPollSteps([]);
          setIsSubmitting(false);
          setError("Job timed out after 5 minutes");
        };

        pollForResult();
        return;
      }

      // Synchronous response
      const responseData = resourceResponse.response || resourceResponse;

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

  if (!resource) return null;

  const avatarUrl = resource.avatar_url || resource.extra?.avatarUrl;
  const displayName =
    formatResourcePath(resource) ||
    resource.extra?.agentName ||
    resource.extra?.serviceName ||
    resource.name;

  const headerAvatar = (
    <DrawerHeaderAvatar
      src={avatarUrl}
      fallbackIcon={<Box className="h-8 w-8 text-resource" />}
      fallbackClassName="bg-resource/20"
    />
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-start gap-4 py-1">
          {headerAvatar}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-lg">
              Try {displayName}
            </div>
            {resource.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {resource.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <span className="font-medium">{priceDisplay} USDC</span>
              {resource.network === "solana" && (
                <SolanaIcon className="w-3 h-3" />
              )}
            </div>
          </div>
        </div>
      }
      stackLevel={2}
      footer={
        <div className="flex justify-end">
          {user ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isPolling || !isFormValid}
              variant="primary"
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
                  Submit & Pay {priceDisplay} USDC
                </>
              )}
            </Button>
          ) : (
            <Button as={Link} href="/login" variant="primary">
              <LogIn className="h-4 w-4 mr-2" />
              Sign in to Try
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Dynamic Form Fields */}
        {fieldEntries.length > 0 ? (
          <div className="space-y-4">
            {fieldEntries.map(([fieldName, field]) => {
              const formatType = (type: string) => {
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
                    return type;
                }
              };

              const hasError = !!fieldErrors[fieldName];

              return (
                <div key={fieldName} className="space-y-1.5">
                  {field.type !== "boolean" && (
                    <Label
                      htmlFor={fieldName}
                      className="flex items-center gap-1.5 capitalize text-sm"
                    >
                      {fieldName.replace(/([A-Z])/g, " $1").trim()}
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
                      value={formData[fieldName] || ""}
                      onChange={(value) => handleFieldChange(fieldName, value)}
                      placeholder="Select..."
                      options={field.enum.map((opt) => ({
                        value: opt,
                        label: opt,
                      }))}
                    />
                  ) : field.type === "boolean" ? (
                    <div className="flex items-center justify-between py-1">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium capitalize">
                          {fieldName.replace(/([A-Z])/g, " $1").trim()}
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
                        checked={formData[fieldName] === "true"}
                        onCheckedChange={(checked) =>
                          handleFieldChange(
                            fieldName,
                            checked ? "true" : "false",
                          )
                        }
                      />
                    </div>
                  ) : field.type === "array" ? (
                    <div className="space-y-1">
                      <textarea
                        id={fieldName}
                        placeholder={
                          field.description ||
                          `Enter ${fieldName} (one per line)...`
                        }
                        value={formData[fieldName] || ""}
                        onChange={(e) =>
                          handleFieldChange(fieldName, e.target.value)
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
                      value={formData[fieldName] || ""}
                      onChange={(value) => handleFieldChange(fieldName, value)}
                      placeholder={
                        field.description ||
                        `Upload or enter URL for ${fieldName}...`
                      }
                      hasError={hasError}
                    />
                  ) : (
                    <Input
                      id={fieldName}
                      type={
                        field.type === "number" || field.type === "integer"
                          ? "number"
                          : "text"
                      }
                      placeholder={field.description || `Enter ${fieldName}...`}
                      value={formData[fieldName] || ""}
                      onChange={(e) =>
                        handleFieldChange(fieldName, e.target.value)
                      }
                      className={hasError ? "border-destructive" : ""}
                    />
                  )}

                  {hasError && (
                    <p className="text-xs text-destructive">
                      {fieldErrors[fieldName]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Box className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No input fields required</p>
            <p className="text-xs mt-1">Just click submit to execute</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {pollSteps.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground mb-1.5">Failed at step:</p>
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
            {(() => {
              const trimmed = result.response.trim();
              const looksLikeJson =
                trimmed.startsWith("{") || trimmed.startsWith("[");

              if (looksLikeJson) {
                try {
                  const parsed = JSON.parse(trimmed);
                  return (
                    <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto overflow-y-auto max-h-64 font-mono whitespace-pre-wrap break-words">
                      {JSON.stringify(parsed, null, 2)}
                    </pre>
                  );
                } catch {
                  return (
                    <div className="p-4 bg-muted rounded-lg prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{result.response}</ReactMarkdown>
                    </div>
                  );
                }
              } else {
                return (
                  <div className="p-4 bg-muted rounded-lg prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{result.response}</ReactMarkdown>
                  </div>
                );
              }
            })()}
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
