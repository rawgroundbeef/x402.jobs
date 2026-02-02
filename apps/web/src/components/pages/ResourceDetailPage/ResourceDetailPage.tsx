"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import { z } from "zod";
import { publicFetcher, authenticatedFetch } from "@/lib/api";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Label } from "@x402jobs/ui/label";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import {
  Box,
  Play,
  Trash2,
  Loader2,
  ExternalLink,
  Pencil,
  Copy,
  Check,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  AlertTriangle,
  Network,
} from "lucide-react";
import { useToast } from "@x402jobs/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import BaseLayout from "@/components/BaseLayout";
import { Avatar } from "@/components/Avatar";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { ClaimOwnershipButton } from "@/components/ClaimOwnershipButton";
import { ResourceEditModal } from "@/components/modals/ResourceEditModal";
import { Dropdown, DropdownItem, DropdownDivider } from "@x402jobs/ui/dropdown";
import { RelatedJobs } from "@/components/RelatedJobs";
import { ImageUrlOrUpload } from "@/components/inputs";
import { Card } from "@x402jobs/ui/card";
import { Tooltip } from "@x402jobs/ui/tooltip";
import {
  formatPrice,
  getSuccessRateDisplay,
  getSuccessRateTier,
} from "@/lib/format";
import { getNetwork } from "@/lib/networks";
import { useRouter } from "next/navigation";
import {
  PollingProgress,
  ResultDisplay,
  SyncResultDisplay,
  useLROPolling,
  type LROPayment,
  type LROResult,
} from "@/components/lro";

interface PromptTemplateParameter {
  name: string;
  description?: string;
  required?: boolean;
  default?: string;
}

interface ResourceData {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  resource_url: string;
  resource_type?: string;
  network: string;
  max_amount_required?: string;
  avatar_url?: string;
  server_id?: string;
  server_name?: string;
  server_slug?: string;
  server_favicon?: string;
  server_origin_url?: string;
  server_verified_owner_id?: string;
  server_owner_username?: string;
  server_owner_display_name?: string;
  server_owner_avatar_url?: string;
  server_is_hosted?: boolean;
  output_schema?: {
    input?: {
      method?: string;
      bodyFields?: Record<string, FieldDef>;
      queryParams?: Record<string, FieldDef>;
    };
    output?: Record<string, unknown>;
  };
  extra?: Record<string, unknown>;
  is_verified: boolean;
  is_a2a?: boolean;
  supports_refunds?: boolean;
  created_at: string;
  registered_by?: string;
  verified_owner_id?: string;
  call_count?: number;
  total_earned_usdc?: string;
  success_count_30d?: number;
  failure_count_30d?: number;
  // Prompt template specific fields
  parameters?: PromptTemplateParameter[];
  model?: string;
  allows_user_message?: boolean;
  price_usdc?: string;
  // OpenRouter specific fields
  openrouter_model_id?: string;
  model_name?: string;
  model_provider?: string;
  model_context_length?: number;
}

interface FieldDef {
  type?: string;
  required?: boolean;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
  items?: { type: string };
  // Allow nested fields
  [key: string]:
    | FieldDef
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

// Check if a field has nested child fields
function hasNestedFields(field: FieldDef): boolean {
  return Object.keys(field).some((key) => !META_KEYS.has(key));
}

// Get child fields from a parent field
function getChildFields(field: FieldDef): Record<string, FieldDef> {
  const children: Record<string, FieldDef> = {};
  for (const [key, value] of Object.entries(field)) {
    if (!META_KEYS.has(key) && typeof value === "object" && value !== null) {
      children[key] = value as FieldDef;
    }
  }
  return children;
}

// Helper to find field definition by dot-path
function findFieldDef(
  fieldDefs: Record<string, FieldDef>,
  path: string,
): FieldDef | undefined {
  const parts = path.split(".");
  let current: Record<string, FieldDef> = fieldDefs;
  let field: FieldDef | undefined;

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
  fieldDefs: Record<string, FieldDef>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(formData)) {
    if (value === "" || value === undefined) continue;

    const parts = path.split(".");
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
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
    const fieldDef = findFieldDef(fieldDefs, path);
    let finalValue: unknown = value;

    if (fieldDef?.type === "array" && typeof value === "string") {
      finalValue = value
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }

    if (/^\d+$/.test(lastPart)) {
      const idx = parseInt(lastPart, 10);
      if (Array.isArray(current)) {
        current[idx] = finalValue;
      } else {
        current[lastPart] = finalValue;
      }
    } else {
      current[lastPart] = finalValue;
    }
  }

  return result;
}

// Humanize a parameter name for display (prompt_template)
function humanizeParamName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/\s+/g, " ");
}

// Get smart default for a field based on name and type
function getSmartDefault(
  fieldName: string,
  field: FieldDef,
): string | undefined {
  const lowerName = fieldName.toLowerCase();

  if (lowerName === "jsonrpc") return "2.0";

  if (
    lowerName === "id" ||
    lowerName === "message_id" ||
    lowerName === "messageid" ||
    lowerName.endsWith("_id")
  ) {
    return crypto.randomUUID();
  }

  if (lowerName === "role") {
    if (field.enum?.includes("ROLE_USER")) return "ROLE_USER";
    if (field.enum?.includes("user")) return "user";
  }

  if (field.enum && field.enum.length > 0) {
    return field.enum[0];
  }

  if (field.default !== undefined) {
    return String(field.default);
  }

  return undefined;
}

interface ResourceDetailPageProps {
  serverSlug: string;
  resourceSlug: string;
}

type TabType = "overview" | "api" | "activity";

export default function ResourceDetailPage({
  serverSlug: rawServerSlug,
  resourceSlug,
}: ResourceDetailPageProps) {
  const router = useRouter();
  // Decode URL-encoded slug (e.g., %40rawgroundbeef -> @rawgroundbeef)
  const serverSlug = decodeURIComponent(rawServerSlug);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Prompt template specific state
  const [ptUserMessage, setPtUserMessage] = useState("");

  // Try-it form state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [payment, setPayment] = useState<LROPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);

  // LRO polling hook
  const lro = useLROPolling({ maxAttempts: 120 });

  const {
    data,
    isLoading,
    error: fetchError,
    mutate,
  } = useSWR<{
    resource: ResourceData;
  }>(`/api/v1/resources/${serverSlug}/${resourceSlug}`, publicFetcher);

  const resource = data?.resource;

  // Check ownership
  const isServerOwner =
    user?.id && resource?.server_verified_owner_id === user.id;
  const isResourceOwner = user?.id && resource?.verified_owner_id === user.id;
  const isOwner = isServerOwner || isResourceOwner;
  const canEdit = isAdmin || isOwner;

  // Check if this is a prompt_template resource
  const isPromptTemplate = resource?.resource_type === "prompt_template";

  // Check if this is an OpenRouter instant resource
  const isOpenRouter = resource?.resource_type === "openrouter_instant";

  // Sort prompt_template parameters: required first, then optional
  const sortedPtParameters = useMemo(() => {
    if (!resource?.parameters) return [];
    return [...resource.parameters].sort((a, b) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });
  }, [resource?.parameters]);

  // Avatar with fallback
  const avatarUrl =
    resource?.avatar_url ||
    (resource?.extra as { avatarUrl?: string })?.avatarUrl ||
    resource?.server_favicon;

  // Extract input fields from schema
  const inputFields = useMemo(() => {
    const bodyFields = resource?.output_schema?.input?.bodyFields || {};
    const queryParams = resource?.output_schema?.input?.queryParams || {};
    return { ...bodyFields, ...queryParams };
  }, [resource]);

  const fieldEntries = useMemo(() => {
    return Object.entries(inputFields).sort(([, a], [, b]) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });
  }, [inputFields]);

  const hasInputs = fieldEntries.length > 0;

  // Initialize form with defaults (recursive for nested fields)
  useEffect(() => {
    if (!resource) return;

    const defaults: Record<string, string> = {};

    const collectDefaults = (
      fields: Record<string, FieldDef>,
      parentPath: string = "",
    ) => {
      for (const [fieldName, field] of Object.entries(fields)) {
        const path = parentPath ? `${parentPath}.${fieldName}` : fieldName;

        const smartDefault = getSmartDefault(fieldName, field);
        if (smartDefault !== undefined) {
          defaults[path] = smartDefault;
        }

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

  // Initialize prompt_template form with defaults
  useEffect(() => {
    if (!resource?.parameters || !(isPromptTemplate || isOpenRouter)) return;

    const defaults: Record<string, string> = {};
    for (const param of resource.parameters) {
      if (param.default !== undefined) {
        defaults[param.name] = param.default;
      }
    }

    if (Object.keys(defaults).length > 0) {
      setFormData((prev) => ({ ...defaults, ...prev }));
    }
  }, [resource?.parameters, isPromptTemplate, isOpenRouter]);

  // Validate prompt_template form
  const validatePtForm = useCallback((): boolean => {
    if (!resource?.parameters) return true;

    const errors: Record<string, string> = {};
    let isValid = true;

    for (const param of resource.parameters) {
      if (param.required) {
        const value = formData[param.name]?.trim();
        if (!value) {
          errors[param.name] = `${humanizeParamName(param.name)} is required`;
          isValid = false;
        }
      }
    }

    setFieldErrors(errors);
    return isValid;
  }, [resource?.parameters, formData]);

  // Check if prompt_template form is valid
  const isPtFormValid = useMemo(() => {
    if (!resource?.parameters) return true;

    for (const param of resource.parameters) {
      if (param.required) {
        const value = formData[param.name]?.trim();
        if (!value) return false;
      }
    }
    return true;
  }, [resource?.parameters, formData]);

  // Build Zod schema for validation
  const formSchema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [fieldName, field] of fieldEntries) {
      let fieldSchema: z.ZodTypeAny = z.string();
      if (field.required) {
        shape[fieldName] = z.string().min(1, `${fieldName} is required`);
      } else {
        shape[fieldName] = fieldSchema.optional();
      }
    }
    return z.object(shape);
  }, [fieldEntries]);

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

  const isFormValid = useMemo(() => {
    const result = formSchema.safeParse(formData);
    return result.success;
  }, [formSchema, formData]);

  const priceDisplay = formatPrice(resource?.max_amount_required);
  const priceNum = resource?.max_amount_required
    ? parseFloat(resource.max_amount_required) / 1_000_000
    : 0;
  const isFree = priceNum === 0;

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
    if (!user) {
      // TODO: Open login modal
      return;
    }

    // Use different validation for prompt_template and openrouter_instant
    if (isPromptTemplate || isOpenRouter) {
      if (!validatePtForm()) return;
    } else {
      if (!validateForm()) return;
    }

    setIsSubmitting(true);
    setSyncError(null);
    setSyncResult(null);
    setPayment(null);
    setShowFullResult(false);
    lro.reset();

    try {
      let requestBody: Record<string, unknown>;
      let method: string;

      if (isPromptTemplate || isOpenRouter) {
        // Build simple body for prompt_template and openrouter_instant
        requestBody = { ...formData };
        if (resource.allows_user_message && ptUserMessage.trim()) {
          requestBody.user_message = ptUserMessage.trim();
        }
        method = "POST";
      } else {
        // Build nested object from flat dot-notation formData for regular resources
        requestBody = buildNestedObject(formData, inputFields);
        // For x402 external resources (not hosted on platform), use POST as many servers
        // require it for payments
        method = !resource.server_is_hosted
          ? "POST"
          : resource.output_schema?.input?.method || "POST";
      }

      const response = await authenticatedFetch("/execute", {
        method: "POST",
        body: JSON.stringify({
          resourceId: resource.id,
          resourceUrl: resource.resource_url,
          method: method,
          body: requestBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 402 &&
          data.required &&
          data.available !== undefined
        ) {
          setSyncError(
            `Insufficient balance: need $${data.required.toFixed(2)} USDC, have $${data.available.toFixed(2)}. Please fund your wallet.`,
          );
        } else {
          setSyncError(data.error || data.details || "Request failed");
        }
        return;
      }

      // Show toast for payment (especially useful for prompt_template)
      if (data.paid && data.payment) {
        const amount = data.payment.amountUsdc || data.payment.amount;
        const networkName =
          resource.network === "base" || resource.network.includes("8453")
            ? "Base"
            : "Solana";
        toast({
          title: "Payment Successful",
          description: `$${amount.toFixed(4)} USDC on ${networkName}`,
          variant: "success",
        });
      }

      if (data.payment) {
        setPayment({
          amount: data.payment.amountUsdc || data.payment.amount,
          transaction: data.payment.signature || data.payment.transaction,
        });
      }

      const resourceResponse = data.data || data;

      // Check if this is an LRO response that needs polling
      // Accept both jobId (documented) and runId (legacy) as identifiers
      const asyncJobId = resourceResponse.jobId || resourceResponse.runId;
      if (resourceResponse.statusUrl && asyncJobId) {
        setIsSubmitting(false);
        await lro.startPolling(
          resourceResponse.statusUrl,
          resourceResponse.retryAfterSeconds || 2,
        );
        return;
      }

      // Handle pending status with internal polling endpoint
      if (asyncJobId && resourceResponse.status === "pending") {
        setIsSubmitting(false);
        await lro.startPolling(
          `/execute/status/${encodeURIComponent(resource.resource_url)}/${asyncJobId}`,
          2,
        );
        return;
      }

      // Synchronous response
      setSyncResult(resourceResponse);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSaved = (newSlug?: string) => {
    if (newSlug) {
      router.push(`/resources/${serverSlug}/${newSlug}`);
    }
    mutate();
  };

  // Create a job with this resource pre-wired between trigger and output
  const handleCreateJob = async () => {
    if (!resource || !user) return;

    setIsCreatingJob(true);

    try {
      const price = resource.max_amount_required
        ? parseFloat(resource.max_amount_required) / 1_000_000
        : 0.01;

      const workflow_data = {
        nodes: [
          {
            id: "trigger-1",
            type: "trigger",
            position: { x: 100, y: 200 },
            data: {},
          },
          {
            id: "resource-1",
            type: "resource",
            position: { x: 350, y: 200 },
            data: {
              resource: {
                id: resource.id,
                name: resource.name,
                slug: resource.slug,
                serverSlug: resource.server_slug,
                description: resource.description,
                price: price,
                avatarUrl: avatarUrl, // Use the computed avatarUrl with fallbacks
                resourceUrl: resource.resource_url,
                network: resource.network,
                // Include prompt_template fields if applicable
                ...(isPromptTemplate && {
                  resource_type: "prompt_template",
                  pt_parameters: resource.parameters,
                  allows_user_message: resource.allows_user_message,
                  model: resource.model,
                }),
                // Include openrouter_instant fields if applicable
                ...(isOpenRouter && {
                  resource_type: "openrouter_instant",
                  pt_parameters: resource.parameters,
                  allows_user_message: resource.allows_user_message,
                  model_name: resource.model_name,
                  model_provider: resource.model_provider,
                }),
              },
              configuredInputs: {},
            },
          },
          {
            id: "output-1",
            type: "output",
            position: { x: 600, y: 200 },
            data: { result: null, isLoading: false },
          },
        ],
        edges: [
          {
            id: "e-trigger-resource",
            source: "trigger-1",
            target: "resource-1",
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
          {
            id: "e-resource-output",
            source: "resource-1",
            target: "output-1",
            animated: true,
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          },
        ],
      };

      const res = await authenticatedFetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${resource.name} Job`,
          network: resource.network,
          workflow_data: workflow_data,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create job");
      }

      const data = await res.json();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleDeleteClick = () => {
    if (!canEdit || !resource) return;
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!resource) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await authenticatedFetch(`/resources/${resource.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete resource");
      }
      setShowDeleteDialog(false);
      router.push("/resources");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, type: "url" | "output") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 2000);
    }
  };

  // Extract LRO result with explicit type for rendering
  const lroResult = lro.result as LROResult | null;
  const hasLroResult = lroResult !== null;

  // Stats
  const totalEarned = resource?.total_earned_usdc
    ? parseFloat(resource.total_earned_usdc)
    : 0;
  const successRateInfo = getSuccessRateDisplay(
    resource?.success_count_30d,
    resource?.failure_count_30d,
  );

  // Extra info for overview tab
  const extraInfo = resource?.extra || {};
  const category =
    (extraInfo as { category?: string }).category ||
    (extraInfo as { type?: string }).type;
  const agent = (extraInfo as { agent?: string }).agent;
  const service = (extraInfo as { service?: string }).service;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !resource) {
    return (
      <BaseLayout maxWidth="max-w-5xl">
        <main className="max-w-4xl mx-auto px-4 py-20 text-center">
          <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Resource not found</p>
        </main>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout maxWidth="max-w-5xl">
      <main className="w-full pb-12">
        {/* Header Section */}
        <div className="py-10 md:py-12">
          {/* Avatar - centered */}
          <div className="flex justify-center mb-5">
            <Avatar
              src={avatarUrl}
              alt={resource.name}
              size="3xl"
              fallbackIcon={<Box className="w-14 h-14 text-muted-foreground" />}
              className="border-2 border-border"
            />
          </div>

          {/* Title row with owner dropdown */}
          <div className="flex items-start justify-center gap-4">
            <div className="text-center flex-1">
              {/* Name - Server portion clickable */}
              <h1 className="text-2xl md:text-3xl font-bold font-mono mb-2">
                {(() => {
                  // For hosted servers (@username), link to user profile
                  if (serverSlug.startsWith("@")) {
                    const username = serverSlug.slice(1);
                    return (
                      <>
                        <Link
                          href={`/@${username}`}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          @{username}
                        </Link>
                        <span className="text-muted-foreground/50">/</span>
                        <span>{resourceSlug}</span>
                      </>
                    );
                  }

                  // For regular servers, link to server page
                  return (
                    <>
                      <Link
                        href={`/servers/${serverSlug}`}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {serverSlug}
                      </Link>
                      <span className="text-muted-foreground/50">/</span>
                      <span>{resourceSlug}</span>
                    </>
                  );
                })()}
              </h1>

              {/* URL */}
              <a
                href={resource.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3 transition-colors font-mono"
              >
                <span className="truncate max-w-md">
                  {resource.resource_url}
                </span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>

              {/* Owner */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {resource.server_owner_username ? (
                  <>
                    <Link
                      href={`/@${resource.server_owner_username}`}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Owned by @{resource.server_owner_username}
                    </Link>
                    {resource.server_verified_owner_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </>
                ) : (
                  // Don't show Claim for hosted servers (platform-managed)
                  resource.server_id &&
                  !resource.server_is_hosted && (
                    <ClaimOwnershipButton
                      serverId={resource.server_id}
                      serverSlug={resource.server_slug || serverSlug}
                      serverOriginUrl={resource.server_origin_url || ""}
                      isLoggedIn={!!user}
                      ownerUsername={resource.server_owner_username}
                      onSuccess={() => mutate()}
                    />
                  )
                )}
              </div>

              {/* Description */}
              {resource.description && (
                <p className="text-muted-foreground max-w-lg mx-auto mb-4 leading-relaxed">
                  {resource.description}
                </p>
              )}

              {deleteError && (
                <p className="text-sm text-destructive mt-3">{deleteError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Action Zone - Stats + CTAs + Trust Signals */}
        <Card className="p-6 bg-muted/30 border-border/50 mb-8 relative">
          {/* Owner actions dropdown - top right corner */}
          {canEdit && (
            <div className="absolute top-4 right-4">
              <Dropdown
                trigger={
                  <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                }
                placement="bottom-end"
              >
                <DropdownItem onClick={() => setShowEditModal(true)}>
                  <span className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </span>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem
                  onClick={handleDeleteClick}
                  className="text-destructive"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </span>
                </DropdownItem>
              </Dropdown>
            </div>
          )}
          <div className="flex flex-col items-center">
            {/* Stats Bar */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm mb-6">
              {/* Success Rate (with tier) */}
              {(() => {
                const tier = getSuccessRateTier(successRateInfo.rate!);
                const totalCalls =
                  (resource?.success_count_30d ?? 0) +
                  (resource?.failure_count_30d ?? 0);

                if (successRateInfo.isNew) {
                  return (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-xs font-medium">
                      New
                    </span>
                  );
                }

                return (
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${tier.color}`}
                  >
                    {tier.showWarning && (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    {successRateInfo.text} success
                    <span className="font-normal text-muted-foreground">
                      ({totalCalls} calls)
                    </span>
                  </span>
                );
              })()}

              <span className="text-muted-foreground/50">|</span>

              {/* Network */}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <ChainIcon
                  network={resource.network}
                  className={`h-3.5 w-3.5 ${getNetwork(resource.network).id === "base" ? "text-blue-500" : "text-purple-500"}`}
                />
                {getNetwork(resource.network).name}
              </span>

              {/* A2A badge inline */}
              {resource.is_a2a && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    A2A
                  </span>
                </>
              )}

              {/* Owner earnings (only for owners) */}
              {canEdit && totalEarned > 0 && (
                <>
                  <span className="text-muted-foreground/50">|</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    $
                    {totalEarned > 1000
                      ? `${(totalEarned / 1000).toFixed(1)}k`
                      : totalEarned.toFixed(2)}{" "}
                    earned
                  </span>
                </>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row justify-center gap-2 mb-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleCreateJob}
                disabled={isCreatingJob || !user}
                className="w-full sm:w-auto"
              >
                {isCreatingJob ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Use in Job"
                )}
              </Button>

              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  lro.isPolling ||
                  (isPromptTemplate || isOpenRouter
                    ? !isPtFormValid
                    : hasInputs && !isFormValid) ||
                  !user
                }
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Running...
                  </>
                ) : lro.isPolling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : !user ? (
                  "Login to Run"
                ) : isFree ? (
                  "Run (Free)"
                ) : (
                  `Run (${priceDisplay})`
                )}
              </Button>
            </div>

            {/* Refund + Attribution line (merged) */}
            {resource.supports_refunds && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <img src="/badges/shield-icon.svg" alt="" className="h-4 w-4" />
                <Tooltip
                  content={
                    <>
                      Refunds provided by{" "}
                      <a
                        href="https://openfacilitator.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-300"
                      >
                        OpenFacilitator.io
                      </a>
                      . If the request fails, you&apos;ll be automatically
                      refunded.
                    </>
                  }
                >
                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                    Refund Protected
                  </span>
                </Tooltip>{" "}
                via{" "}
                <a
                  href="https://openfacilitator.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  OpenFacilitator
                </a>
              </p>
            )}
          </div>
        </Card>

        {/* Model Info Display (OpenRouter) */}
        {isOpenRouter && resource?.model_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Network className="h-4 w-4 text-indigo-500" />
            <span>{resource.model_name}</span>
            {resource.model_provider && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded">
                {resource.model_provider}
              </span>
            )}
          </div>
        )}

        {/* Form Section */}
        <div className="mb-8">
          {/* Prompt Template / OpenRouter Form - Simple Parameters */}
          {(isPromptTemplate || isOpenRouter) &&
            sortedPtParameters.length > 0 && (
              <div className="space-y-4 mb-6">
                {sortedPtParameters.map((param) => {
                  const hasError = !!fieldErrors[param.name];
                  return (
                    <div key={param.name}>
                      <Label htmlFor={param.name} className="mb-1.5 block">
                        {humanizeParamName(param.name)}
                        {param.required && (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </Label>
                      <Input
                        id={param.name}
                        type="text"
                        value={formData[param.name] || ""}
                        onChange={(e) =>
                          handleFieldChange(param.name, e.target.value)
                        }
                        placeholder={
                          param.description ||
                          `Enter ${humanizeParamName(param.name)}...`
                        }
                        className={hasError ? "border-destructive" : ""}
                      />
                      {hasError && (
                        <p className="text-xs text-destructive mt-1">
                          {fieldErrors[param.name]}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* User Message Input for prompt_template */}
                {resource?.allows_user_message && (
                  <div>
                    <Label htmlFor="pt_user_message" className="mb-1.5 block">
                      Your Message (optional)
                    </Label>
                    <Textarea
                      id="pt_user_message"
                      value={ptUserMessage}
                      onChange={(e) => setPtUserMessage(e.target.value)}
                      placeholder="Add an optional message to accompany your request..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}

          {/* Form Fields - Recursive Renderer (for non-prompt_template and non-openrouter) */}
          {!(isPromptTemplate || isOpenRouter) && hasInputs ? (
            <div className="space-y-4 mb-6">
              {(() => {
                const MAX_DEPTH = 4;

                // Render a single primitive field
                const renderPrimitiveField = (
                  fieldName: string,
                  field: FieldDef,
                  path: string,
                ) => {
                  const hasError = !!fieldErrors[path];

                  return (
                    <div key={path}>
                      <Label htmlFor={path} className="mb-1.5 block">
                        {fieldName
                          .replace(/([A-Z])/g, " $1")
                          .replace(/_/g, " ")
                          .trim()}
                        {field.required && (
                          <span className="text-destructive ml-0.5">*</span>
                        )}
                      </Label>
                      {field.enum ? (
                        <select
                          id={path}
                          value={formData[path] || ""}
                          onChange={(e) =>
                            handleFieldChange(path, e.target.value)
                          }
                          className={`w-full h-10 px-3 rounded-md border bg-background text-sm ${
                            hasError ? "border-destructive" : "border-input"
                          }`}
                        >
                          <option value="">Select...</option>
                          {field.enum.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "boolean" ? (
                        <select
                          id={path}
                          value={formData[path] || ""}
                          onChange={(e) =>
                            handleFieldChange(path, e.target.value)
                          }
                          className={`w-full h-10 px-3 rounded-md border bg-background text-sm ${
                            hasError ? "border-destructive" : "border-input"
                          }`}
                        >
                          <option value="">Select...</option>
                          <option value="true">True</option>
                          <option value="false">False</option>
                        </select>
                      ) : field.type === "array" ? (
                        <Textarea
                          id={path}
                          value={formData[path] || ""}
                          onChange={(e) =>
                            handleFieldChange(path, e.target.value)
                          }
                          placeholder={
                            field.description || "One item per line..."
                          }
                          rows={3}
                          className={hasError ? "border-destructive" : ""}
                        />
                      ) : field.type === "file" ? (
                        <ImageUrlOrUpload
                          value={formData[path] || ""}
                          onChange={(value) => handleFieldChange(path, value)}
                          placeholder={
                            field.description || "Upload file or paste URL..."
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
                          value={formData[path] || ""}
                          onChange={(e) =>
                            handleFieldChange(path, e.target.value)
                          }
                          placeholder={
                            field.description || `Enter ${fieldName}...`
                          }
                          className={hasError ? "border-destructive" : ""}
                        />
                      )}
                      {hasError && (
                        <p className="text-xs text-destructive mt-1">
                          {fieldErrors[path]}
                        </p>
                      )}
                    </div>
                  );
                };

                // Recursive field renderer
                const renderFields = (
                  fields: Record<string, FieldDef>,
                  parentPath: string = "",
                  depth: number = 0,
                ): React.ReactNode[] => {
                  if (depth >= MAX_DEPTH) {
                    return [
                      <div key={parentPath}>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">
                          {parentPath} (JSON)
                        </Label>
                        <Textarea
                          placeholder="Enter JSON..."
                          value={formData[parentPath] || ""}
                          onChange={(e) =>
                            handleFieldChange(parentPath, e.target.value)
                          }
                          rows={3}
                          className="font-mono"
                        />
                      </div>,
                    ];
                  }

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

                    return renderPrimitiveField(fieldName, field, path);
                  });
                };

                return renderFields(inputFields);
              })()}
            </div>
          ) : null}

          {/* Output Section */}
          {syncResult !== null ||
          syncError !== null ||
          lroResult !== null ||
          lro.error !== null ||
          lro.isPolling ||
          isSubmitting ? (
            <div className="mt-6">
              {/* Submitting state */}
              {isSubmitting && (
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </div>
              )}

              {/* LRO Polling Progress */}
              {lro.isPolling && (
                <PollingProgress
                  pollStatus={lro.pollStatus}
                  pollProgress={lro.pollProgress}
                  pollSteps={lro.pollSteps}
                  pollRawData={lro.pollRawData}
                  showAdvancedLogs={lro.showAdvancedLogs}
                  onAdvancedLogsToggle={lro.setShowAdvancedLogs}
                />
              )}

              {/* LRO Result */}
              {hasLroResult && lroResult && (
                <ResultDisplay
                  result={lroResult}
                  payment={payment}
                  showFullResult={showFullResult}
                  onShowFullResultToggle={() =>
                    setShowFullResult(!showFullResult)
                  }
                  outputCopied={outputCopied}
                  onCopyOutput={(text) => {
                    navigator.clipboard.writeText(text);
                    setOutputCopied(true);
                    setTimeout(() => setOutputCopied(false), 2000);
                  }}
                />
              )}

              {/* LRO Error */}
              {lro.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{lro.error}</p>
                  </div>
                </div>
              )}

              {/* Sync Error */}
              {syncError && !isSubmitting && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{syncError}</p>
                  </div>
                </div>
              )}

              {/* Sync Result (non-LRO) */}
              {syncResult && !isSubmitting && (
                <SyncResultDisplay
                  data={syncResult}
                  outputCopied={outputCopied}
                  onCopyOutput={(text) => copyToClipboard(text, "output")}
                />
              )}
            </div>
          ) : null}
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-6" />

        {/* Tabs Section */}
        <div className="border-b border-border mb-6">
          <div className="flex gap-6">
            {(["overview", "api", "activity"] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "overview"
                  ? "Overview"
                  : tab === "api"
                    ? "API Details"
                    : "Activity"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-3">
            {category && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Category</span>
                <span className="text-sm font-medium">{category}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Currency</span>
              <span className="text-sm font-medium">USDC</span>
            </div>
            {agent && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Agent</span>
                <span className="text-sm font-medium font-mono">{agent}</span>
              </div>
            )}
            {service && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Service</span>
                <span className="text-sm font-medium">{service}</span>
              </div>
            )}
            {resource.server_slug && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Server</span>
                <Link
                  href={`/servers/${resource.server_slug}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {resource.server_name || resource.server_slug}
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "api" && (
          <div className="space-y-6">
            {/* Endpoint URL */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Endpoint URL</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded overflow-x-auto">
                  {resource.resource_url}
                </code>
                <button
                  onClick={() => copyToClipboard(resource.resource_url, "url")}
                  className="p-2 hover:bg-accent rounded transition-colors"
                  title="Copy URL"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                <a
                  href={resource.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-accent rounded transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Input Schema */}
            {resource.output_schema && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Input Schema</h3>
                <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(resource.output_schema, null, 2)}
                </pre>
              </div>
            )}

            {/* Extra Info */}
            {resource.extra && Object.keys(resource.extra).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Additional Info</h3>
                <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify(resource.extra, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="text-center py-12">
            <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Activity tracking coming soon
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Recent runs and usage statistics will appear here
            </p>
          </div>
        )}

        {/* Related Jobs Section */}
        <RelatedJobs
          resourceId={resource.id}
          onUseInJob={user ? handleCreateJob : undefined}
          isCreatingJob={isCreatingJob}
        />
      </main>

      {/* Edit Modal */}
      {resource && showEditModal && (
        <ResourceEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          resource={{
            id: resource.id,
            name: resource.name,
            slug: resource.slug,
            description: resource.description,
            server_slug: serverSlug,
            avatar_url: avatarUrl,
          }}
          onSaved={handleEditSaved}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatedDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <AnimatedDialogContent onClose={() => setShowDeleteDialog(false)}>
          <DialogHeader>
            <AnimatedDialogTitle className="text-destructive">
              Delete Resource
            </AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Are you sure you want to delete &ldquo;{resource?.name}&rdquo;?
              This action cannot be undone.
            </AnimatedDialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="py-2">
              <p className="text-sm text-destructive">{deleteError}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Resource"
              )}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </BaseLayout>
  );
}
