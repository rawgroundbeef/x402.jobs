"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import useSWR from "swr";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Label } from "@x402jobs/ui/label";
import { Select } from "@x402jobs/ui/select";
import { RESOURCE_CATEGORIES } from "@/constants/categories";
import {
  Loader2,
  Check,
  AlertCircle,
  Link,
  Sparkles,
  ArrowLeft,
  Copy,
  Server,
  Box,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { Switch } from "@x402jobs/ui/switch";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { authenticatedFetch, authenticatedFetcher, API_URL } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { ImageUrlOrUpload } from "@/components/inputs/ImageUrlOrUpload";
import { getNetwork } from "@/lib/networks";
import { formatPrice } from "@/lib/format";
import {
  createPromptTemplateSchema,
  CreatePromptTemplateInput,
} from "@/types/prompt-template";
import {
  extractParameterTags,
  findUndefinedTags,
  findUnusedParameters,
} from "@/lib/prompt-template-utils";
import { ModelBrowser } from "@/components/ModelBrowser";
import { AIModel } from "@/hooks/useAIModelsQuery";
import {
  createOpenRouterResourceSchema,
  CreateOpenRouterResourceInput,
} from "@/types/openrouter-resource";

// Generate URL-safe slug from text
function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-$/, "");
  }
  return slug;
}

// Zod schemas
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const proxyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(slugRegex, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  avatarUrl: z.string().optional(),
  priceUsdc: z
    .string()
    .refine(
      (val) => !val || parseFloat(val) >= 0.001,
      "Price must be at least $0.001",
    ),
  network: z.enum(["base", "solana"]),
  proxyOriginUrl: z
    .string()
    .min(1, "Origin URL is required")
    .url("Must be a valid URL"),
  proxyMethod: z.enum(["GET", "POST", "PASS"]),
  proxyAuthHeader: z.string().optional(),
  proxyTimeoutMs: z.string().optional(),
});

const editFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  avatarUrl: z.string().optional(),
});

type ProxyFormData = z.infer<typeof proxyFormSchema>;
type EditFormData = z.infer<typeof editFormSchema>;

type Step = "select" | "form" | "success";
type ResourceType =
  | "external"
  | "proxy"
  | "prompt_template"
  | "openrouter_instant";
type NetworkType = "solana" | "base";

interface EditResourceData {
  id: string;
  name: string;
  description?: string | null;
  network: string;
  price_usdc: string;
  resource_type: "external" | "proxy" | "prompt_template" | "openrouter_instant";
  resource_url?: string;
  avatar_url?: string | null;
  category?: string;
  slug?: string;
  // Prompt template specific fields (optional, only for prompt_template type)
  pt_system_prompt?: string;
  pt_parameters?: Array<{
    name: string;
    description: string;
    required: boolean;
    default?: string;
  }>;
  pt_model?: string;
  pt_max_tokens?: number;
  pt_allows_user_message?: boolean;
  // API key indicator (never the actual key)
  pt_has_api_key?: boolean;
}

interface CreateResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editResource?: EditResourceData | null;
}

interface AcceptOption {
  network: string;
  normalizedNetwork: string;
  payTo: string;
  amount: string;
  asset?: string;
  scheme?: string;
  extra?: Record<string, unknown>;
}

interface VerifiedResource {
  description?: string;
  network?: string;
  payTo?: string;
  maxAmountRequired?: string;
  asset?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: {
    input?: {
      type?: string;
      method?: string;
      bodyType?: string;
      bodyFields?: Record<
        string,
        { type: string; required?: boolean; description?: string }
      >;
    };
    output?: Record<string, unknown>;
  };
  extra?: {
    serviceName?: string;
    agentName?: string;
    avatarUrl?: string;
    [key: string]: unknown;
  };
  serviceName?: string;
  agentName?: string;
  avatarUrl?: string;
  isA2A?: boolean;
}

interface VerifyResponse {
  valid: boolean;
  x402Version?: number;
  accepts?: AcceptOption[];
  service?: { name?: string; description?: string; website?: string };
  resource: VerifiedResource;
  server: ServerPreview;
  warnings?: string[];
  normalizedUrl?: string;
}

interface ServerPreview {
  exists: boolean;
  id: string | null;
  name: string;
  originUrl: string;
  faviconUrl: string | null;
  resourceCount: number;
}

function getResourceNameFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname.replace(/^\//, "") || url.hostname;
  } catch {
    return urlString;
  }
}

// Field error component
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export function CreateResourceModal({
  isOpen,
  onClose,
  onSuccess,
  editResource,
}: CreateResourceModalProps) {
  const router = useRouter();
  const isEditMode = !!editResource;

  // Step management
  const [step, setStep] = useState<Step>(isEditMode ? "form" : "select");
  const [resourceType, setResourceType] = useState<ResourceType | null>(
    isEditMode ? editResource.resource_type : null,
  );

  // External registration state (not part of RHF)
  const [externalUrl, setExternalUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState<VerifiedResource | null>(null);
  const [verifyResponse, setVerifyResponse] = useState<VerifyResponse | null>(
    null,
  );
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(
    null,
  );
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdResource, setCreatedResource] = useState<{
    url: string;
    slug: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Slug availability state
  const [slugStatus, setSlugStatus] = useState<{
    available: boolean;
    reason?: string;
  } | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const slugManuallyEdited = useRef(false);

  // OpenRouter state
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [showModelBrowser, setShowModelBrowser] = useState(false);

  // Claude integration status (for prompt templates)
  const { data: claudeIntegration } = useSWR<{ hasApiKey: boolean }>(
    resourceType === "prompt_template" ? "/integrations/claude/config" : null,
    authenticatedFetcher,
  );

  // OpenRouter integration status (for openrouter_instant resources)
  const { data: openrouterIntegration } = useSWR<{ hasApiKey: boolean }>(
    resourceType === "openrouter_instant"
      ? "/integrations/openrouter/config"
      : null,
    authenticatedFetcher,
  );

  // Proxy form (for create mode)
  const proxyForm = useForm<ProxyFormData>({
    resolver: zodResolver(proxyFormSchema as any),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category: "",
      avatarUrl: "",
      priceUsdc: "0.01",
      network: "base",
      proxyOriginUrl: "",
      proxyMethod: "POST",
      proxyAuthHeader: "",
      proxyTimeoutMs: "30000",
    },
  });

  // Edit form (for edit mode)
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema as any),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      avatarUrl: "",
    },
  });

  // Prompt template form (for create mode)
  const promptTemplateForm = useForm<CreatePromptTemplateInput>({
    resolver: zodResolver(createPromptTemplateSchema as any),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category: "",
      avatar_url: "",
      price_usdc: "0.01",
      network: "base",
      system_prompt: "",
      parameters: [],
      max_tokens: 4096,
      allows_user_message: false,
    },
  });

  // Field array for prompt template parameters
  const {
    fields: parameterFields,
    append: appendParameter,
    remove: removeParameter,
  } = useFieldArray({
    control: promptTemplateForm.control,
    name: "parameters",
  });

  // OpenRouter form (for create mode)
  const openrouterForm = useForm<CreateOpenRouterResourceInput>({
    resolver: zodResolver(createOpenRouterResourceSchema as any),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category: "",
      avatar_url: "",
      price_usdc: "0.01",
      network: "base",
      model_id: "",
      system_prompt: "",
      parameters: [],
      temperature: 1,
      max_tokens: 4096,
      allows_user_message: false,
    },
  });

  // Field array for openrouter parameters
  const {
    fields: orParameterFields,
    append: appendOrParameter,
    remove: removeOrParameter,
  } = useFieldArray({
    control: openrouterForm.control,
    name: "parameters",
  });

  // Auto-add parameters when new tags are detected in system prompt
  const systemPromptValue = promptTemplateForm.watch("system_prompt");
  const parametersValue = promptTemplateForm.watch("parameters");

  useEffect(() => {
    if (!systemPromptValue) return;

    const tagsInPrompt = extractParameterTags(systemPromptValue);
    const existingParamNames = (parametersValue || []).map((p) => p.name);

    // Find tags that don't have a corresponding parameter
    const newTags = tagsInPrompt.filter(
      (tag) => !existingParamNames.includes(tag),
    );

    // Auto-add each new tag as a parameter (without stealing focus)
    newTags.forEach((tag) => {
      appendParameter(
        {
          name: tag,
          description: "",
          required: true,
          default: "",
        },
        { shouldFocus: false },
      );
    });
  }, [systemPromptValue, parametersValue, appendParameter]);

  // Auto-add parameters for OpenRouter form
  const orSystemPromptValue = openrouterForm.watch("system_prompt");
  const orParametersValue = openrouterForm.watch("parameters");

  useEffect(() => {
    if (!orSystemPromptValue) return;

    const tagsInPrompt = extractParameterTags(orSystemPromptValue);
    const existingParamNames = (orParametersValue || []).map((p) => p.name);

    // Find tags that don't have a corresponding parameter
    const newTags = tagsInPrompt.filter(
      (tag) => !existingParamNames.includes(tag),
    );

    // Auto-add each new tag as a parameter (without stealing focus)
    newTags.forEach((tag) => {
      appendOrParameter(
        {
          name: tag,
          description: "",
          required: true,
          default: "",
        },
        { shouldFocus: false },
      );
    });
  }, [orSystemPromptValue, orParametersValue, appendOrParameter]);

  // Initialize forms when editResource changes
  useEffect(() => {
    if (editResource && isOpen) {
      setStep("form");
      setResourceType(editResource.resource_type);

      if (editResource.resource_type === "prompt_template") {
        // Populate prompt template form
        promptTemplateForm.reset({
          name: editResource.name || "",
          slug: editResource.slug || "",
          description: editResource.description || "",
          category: editResource.category || "",
          avatar_url: editResource.avatar_url || "",
          price_usdc: editResource.price_usdc || "0.01",
          network: (editResource.network as "base" | "solana") || "base",
          system_prompt: editResource.pt_system_prompt || "",
          parameters: editResource.pt_parameters || [],
          max_tokens: editResource.pt_max_tokens || 4096,
          allows_user_message: editResource.pt_allows_user_message || false,
        });
      } else {
        // Existing edit form logic for external/proxy
        editForm.reset({
          name: editResource.name || "",
          description: editResource.description || "",
          category: editResource.category || "data",
          avatarUrl: editResource.avatar_url || "",
        });
      }
    }
  }, [editResource, isOpen, editForm, promptTemplateForm]);

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback(
    async (slug: string, network: string) => {
      if (!slug || !slugRegex.test(slug)) {
        setSlugStatus(null);
        return;
      }

      setIsCheckingSlug(true);
      try {
        const res = await authenticatedFetch(
          `/resources/check-slug?slug=${encodeURIComponent(slug)}&network=${network}`,
        );
        const data = await res.json();
        setSlugStatus(data);
      } catch {
        setSlugStatus(null);
      } finally {
        setIsCheckingSlug(false);
      }
    },
    [],
  );

  // Debounced slug check
  const debouncedSlugCheck = useCallback(
    (slug: string, network: string) => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current);
      }
      setSlugStatus(null);
      if (slug && slugRegex.test(slug)) {
        setIsCheckingSlug(true);
        slugCheckTimeoutRef.current = setTimeout(() => {
          checkSlugAvailability(slug, network);
        }, 400);
      }
    },
    [checkSlugAvailability],
  );

  // Auto-generate slug from name (only if user hasn't manually edited)
  const handleNameChange = useCallback(
    (
      name: string,
      formType: "proxy" | "prompt_template" | "openrouter_instant" = "proxy",
    ) => {
      if (!slugManuallyEdited.current) {
        const newSlug = generateSlug(name);
        if (formType === "prompt_template") {
          promptTemplateForm.setValue("slug", newSlug, {
            shouldValidate: true,
          });
          debouncedSlugCheck(newSlug, promptTemplateForm.getValues("network"));
        } else if (formType === "openrouter_instant") {
          openrouterForm.setValue("slug", newSlug, { shouldValidate: true });
          debouncedSlugCheck(newSlug, openrouterForm.getValues("network"));
        } else {
          proxyForm.setValue("slug", newSlug, { shouldValidate: true });
          debouncedSlugCheck(newSlug, proxyForm.getValues("network"));
        }
      }
    },
    [proxyForm, promptTemplateForm, openrouterForm, debouncedSlugCheck],
  );

  // Regenerate slug from current name (resets manual edit flag)
  const regenerateSlug = useCallback(
    (
      formType: "proxy" | "prompt_template" | "openrouter_instant" = "proxy",
    ) => {
      slugManuallyEdited.current = false;
      if (formType === "prompt_template") {
        const name = promptTemplateForm.getValues("name");
        const newSlug = generateSlug(name);
        promptTemplateForm.setValue("slug", newSlug, { shouldValidate: true });
        debouncedSlugCheck(newSlug, promptTemplateForm.getValues("network"));
      } else if (formType === "openrouter_instant") {
        const name = openrouterForm.getValues("name");
        const newSlug = generateSlug(name);
        openrouterForm.setValue("slug", newSlug, { shouldValidate: true });
        debouncedSlugCheck(newSlug, openrouterForm.getValues("network"));
      } else {
        const name = proxyForm.getValues("name");
        const newSlug = generateSlug(name);
        proxyForm.setValue("slug", newSlug, { shouldValidate: true });
        debouncedSlugCheck(newSlug, proxyForm.getValues("network"));
      }
    },
    [proxyForm, promptTemplateForm, openrouterForm, debouncedSlugCheck],
  );

  const handleClose = () => {
    setStep("select");
    setResourceType(null);
    setExternalUrl("");
    setIsVerifying(false);
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);
    setWarnings([]);
    setIsSubmitting(false);
    setError("");
    setCreatedResource(null);
    setCopied(false);
    setSlugStatus(null);
    setIsCheckingSlug(false);
    slugManuallyEdited.current = false;
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    proxyForm.reset();
    editForm.reset();
    promptTemplateForm.reset();
    setSelectedModel(null);
    setShowModelBrowser(false);
    openrouterForm.reset();
    onClose();
  };

  const handleSelectType = (type: ResourceType) => {
    setResourceType(type);
    setStep("form");
    setError("");
  };

  const handleBack = () => {
    setStep("select");
    setResourceType(null);
    setError("");
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);
    setWarnings([]);
  };

  // External verification
  const handleVerify = async () => {
    if (!externalUrl.trim()) return;

    setIsVerifying(true);
    setError("");
    setWarnings([]);
    setVerified(null);
    setVerifyResponse(null);
    setServerPreview(null);
    setSelectedNetworks([]);

    try {
      const res = await fetch(`${API_URL}/api/v1/resources/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: externalUrl }),
      });

      const data: VerifyResponse = await res.json();

      if (!res.ok) {
        const errorData = data as unknown as {
          validationErrors?: string[];
          error?: string;
        };
        if (errorData.validationErrors) {
          throw new Error(errorData.validationErrors.join(". "));
        }
        throw new Error(errorData.error || "Verification failed");
      }

      setVerified(data.resource);
      setVerifyResponse(data);
      setServerPreview(data.server);
      setWarnings(data.warnings || []);

      if (data.accepts && data.accepts.length > 0) {
        setSelectedNetworks([data.accepts[0].normalizedNetwork]);
      } else if (data.resource.network) {
        setSelectedNetworks([data.resource.network]);
      }

      if (data.normalizedUrl) {
        setExternalUrl(data.normalizedUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify URL");
    } finally {
      setIsVerifying(false);
    }
  };

  // External registration
  const handleRegisterExternal = async () => {
    if (!verified || !verifyResponse || selectedNetworks.length === 0) return;

    setIsSubmitting(true);
    setError("");

    const baseName =
      verifyResponse.service?.name ||
      verified.extra?.agentName ||
      verified.serviceName ||
      verified.extra?.serviceName ||
      getResourceNameFromUrl(externalUrl);

    try {
      for (const networkId of selectedNetworks) {
        const acceptOption = verifyResponse.accepts?.find(
          (a) => a.normalizedNetwork === networkId,
        );
        if (!acceptOption) continue;

        const res = await authenticatedFetch("/resources", {
          method: "POST",
          body: JSON.stringify({
            resourceUrl: externalUrl,
            network: acceptOption.normalizedNetwork,
            name: baseName,
            description: verified.description,
            payTo: acceptOption.payTo,
            maxAmountRequired: acceptOption.amount,
            asset: acceptOption.asset,
            mimeType: verified.mimeType,
            maxTimeoutSeconds: verified.maxTimeoutSeconds,
            outputSchema: verified.outputSchema,
            extra: { ...verified.extra, ...acceptOption.extra },
            avatarUrl: verified.avatarUrl || verified.extra?.avatarUrl,
            isA2A: verified.isA2A,
            supportsRefunds: acceptOption.extra?.supportsRefunds === true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Registration failed for ${networkId}`);
        }

        if (data.resource) {
          setCreatedResource({
            url: data.resource.resource_url || externalUrl,
            slug: data.resource.slug,
          });
          setStep("success");
          onSuccess?.();
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register resource",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update resource (edit mode)
  const handleUpdate = async (data: EditFormData) => {
    if (!editResource) return;

    setError("");
    setIsSubmitting(true);

    try {
      const body = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        avatarUrl: data.avatarUrl?.trim() || null,
        category: data.category?.trim() || null,
      };

      const res = await authenticatedFetch(`/resources/${editResource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.error || "Failed to update resource");
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update resource",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create proxy resource
  const handleCreateProxy = async (data: ProxyFormData) => {
    // Check if slug is available before submitting
    if (slugStatus && !slugStatus.available) {
      setError(slugStatus.reason || "Slug is not available");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const body = {
        resourceType: "proxy",
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() || null,
        priceUsdc: parseFloat(data.priceUsdc),
        network: data.network,
        category: data.category,
        avatarUrl: data.avatarUrl?.trim() || null,
        proxyOriginUrl: data.proxyOriginUrl.trim(),
        proxyMethod: data.proxyMethod,
        proxyAuthHeader: data.proxyAuthHeader?.trim() || null,
        proxyTimeoutMs: parseInt(data.proxyTimeoutMs || "30000") || 30000,
      };

      const res = await authenticatedFetch("/resources/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(responseData.error || "Failed to create resource");
      }

      const responseData = await res.json();
      setCreatedResource({
        url: responseData.resource.url,
        slug: responseData.resource.slug,
      });
      setStep("success");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create resource",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create prompt template resource
  const handleCreatePromptTemplate = async (
    data: CreatePromptTemplateInput,
  ) => {
    // Check if slug is available before submitting
    if (slugStatus && !slugStatus.available) {
      setError(slugStatus.reason || "Slug is not available");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const body = {
        resourceType: "prompt_template",
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() || null,
        priceUsdc: parseFloat(data.price_usdc),
        network: data.network,
        category: data.category,
        avatarUrl: data.avatar_url?.trim() || null,
        // Prompt template specific fields
        systemPrompt: data.system_prompt,
        parameters: data.parameters,
        maxTokens: data.max_tokens,
        allowsUserMessage: data.allows_user_message,
        // API key comes from user-level Claude integration
      };

      const res = await authenticatedFetch("/resources/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(
          responseData.error || "Failed to create prompt template",
        );
      }

      const responseData = await res.json();
      setCreatedResource({
        url: responseData.resource.url,
        slug: responseData.resource.slug,
      });
      setStep("success");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create prompt template",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create OpenRouter resource
  const handleCreateOpenRouter = async (
    data: CreateOpenRouterResourceInput,
  ) => {
    if (slugStatus && !slugStatus.available) {
      setError(slugStatus.reason || "Slug is not available");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const body = {
        resourceType: "openrouter_instant",
        name: data.name.trim(),
        slug: data.slug.trim(),
        description: data.description?.trim() || null,
        priceUsdc: parseFloat(data.price_usdc),
        network: data.network,
        category: data.category,
        avatarUrl: data.avatar_url?.trim() || null,
        // OpenRouter specific
        modelId: data.model_id,
        systemPrompt: data.system_prompt,
        parameters: data.parameters,
        temperature: data.temperature,
        maxTokens: data.max_tokens,
        allowsUserMessage: data.allows_user_message,
      };

      const res = await authenticatedFetch("/resources/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(
          responseData.error || "Failed to create OpenRouter resource",
        );
      }

      const responseData = await res.json();
      setCreatedResource({
        url: responseData.resource.url,
        slug: responseData.resource.slug,
      });
      setStep("success");
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create OpenRouter resource",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update prompt template resource (edit mode)
  const handleUpdatePromptTemplate = async (
    data: CreatePromptTemplateInput,
  ) => {
    if (!editResource) return;

    setError("");
    setIsSubmitting(true);

    try {
      const body = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category?.trim() || null,
        avatarUrl: data.avatar_url?.trim() || null,
        priceUsdc: parseFloat(data.price_usdc),
        // Prompt template specific fields
        systemPrompt: data.system_prompt,
        parameters: data.parameters,
        maxTokens: data.max_tokens,
        allowsUserMessage: data.allows_user_message,
        // API key comes from user-level Claude integration
      };

      const res = await authenticatedFetch(`/resources/${editResource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseData = await res.json();
        throw new Error(
          responseData.error || "Failed to update prompt template",
        );
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update prompt template",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUrl = async () => {
    if (!createdResource) return;
    await navigator.clipboard.writeText(createdResource.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const priceDisplay = formatPrice(verified?.maxAmountRequired);
  const resourceName = externalUrl ? getResourceNameFromUrl(externalUrl) : "";

  // Success state
  if (step === "success" && createdResource) {
    return (
      <AnimatedDialog
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
      >
        <AnimatedDialogContent className="max-w-md" onClose={handleClose}>
          <DialogHeader>
            <AnimatedDialogTitle>Resource Created!</AnimatedDialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <p className="text-muted-foreground mb-6">
                Your resource is now live and ready to accept payments.
              </p>
              <div className="bg-muted rounded-lg p-4 relative">
                <code className="text-sm font-mono break-all pr-10">
                  {createdResource.url}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={copyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              onClick={() => {
                onSuccess?.();
                handleClose();
                router.push("/dashboard/resources");
              }}
            >
              View Resources
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    );
  }

  return (
    <AnimatedDialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <AnimatedDialogContent
        className={step === "form" ? "max-w-lg" : "max-w-2xl"}
        onClose={handleClose}
      >
        <DialogHeader>
          <AnimatedDialogTitle>
            {step === "select" ? (
              "Create Resource"
            ) : isEditMode ? (
              <div className="flex items-center gap-3">
                <span>Edit Resource</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    resourceType === "prompt_template"
                      ? "bg-[#D97757]/10 text-[#D97757]"
                      : resourceType === "openrouter_instant"
                        ? "bg-indigo-500/10 text-indigo-500"
                        : "bg-primary/10 text-primary"
                  }`}
                >
                  {resourceType === "external"
                    ? "External"
                    : resourceType === "prompt_template"
                      ? "Claude Prompt"
                      : resourceType === "openrouter_instant"
                        ? "OpenRouter"
                        : "Created"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="p-1 rounded hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span>
                  {resourceType === "external"
                    ? "Register Existing"
                    : resourceType === "prompt_template"
                      ? "Create Claude Prompt"
                      : resourceType === "openrouter_instant"
                        ? "Create OpenRouter Resource"
                        : "Create New Resource"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    resourceType === "external"
                      ? "bg-blue-500/10 text-blue-500"
                      : resourceType === "prompt_template"
                        ? "bg-[#D97757]/10 text-[#D97757]"
                        : resourceType === "openrouter_instant"
                          ? "bg-indigo-500/10 text-indigo-500"
                          : "bg-primary/10 text-primary"
                  }`}
                >
                  {resourceType === "external"
                    ? "External"
                    : resourceType === "prompt_template"
                      ? "Claude"
                      : resourceType === "openrouter_instant"
                        ? "OpenRouter"
                        : "Created"}
                </span>
              </div>
            )}
          </AnimatedDialogTitle>
        </DialogHeader>

        <DialogBody>
          {/* Global Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Type Selection */}
          {step === "select" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-2">
                <button
                  onClick={() => handleSelectType("external")}
                  className="p-4 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                    <Link className="w-5 h-5 text-blue-500" />
                  </div>
                  <h3 className="font-medium mb-1">Register Existing</h3>
                  <p className="text-sm text-muted-foreground">
                    Link an x402 resource from your server
                  </p>
                </button>
                <button
                  onClick={() => handleSelectType("proxy")}
                  className="p-4 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-medium mb-1">Create New</h3>
                  <p className="text-sm text-muted-foreground">
                    Turn any URL into a paid x402 resource
                  </p>
                </button>
                <button
                  onClick={() => handleSelectType("prompt_template")}
                  className="p-4 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden mb-3">
                    <img
                      src="/claude-logo.png"
                      alt="Claude"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="font-medium mb-1">Claude Prompt</h3>
                  <p className="text-sm text-muted-foreground">
                    Monetize your AI prompts
                  </p>
                </button>
{/* TODO: Re-enable after x402-jobs repo migration
                <button
                  onClick={() => handleSelectType("openrouter_instant")}
                  className="p-4 rounded-xl border-2 border-border bg-background hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3 group-hover:bg-indigo-500/20 transition-colors">
                    <Network className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="font-medium mb-1">OpenRouter Model</h3>
                  <p className="text-sm text-muted-foreground">
                    200+ AI models, one endpoint
                  </p>
                </button>
                */}
              </div>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Have a lot of resources?{" "}
                <a
                  href="/docs/resources#programmatic-registration"
                  className="text-primary hover:underline"
                >
                  Add them via our API →
                </a>
              </p>
            </>
          )}

          {/* Step 2a: External Registration Form */}
          {step === "form" && resourceType === "external" && (
            <div className="space-y-4">
              {isEditMode ? (
                <form
                  onSubmit={editForm.handleSubmit(handleUpdate)}
                  className="space-y-4"
                >
                  {/* URL (read-only) */}
                  <div>
                    <Label>Resource URL</Label>
                    <div className="mt-1.5 px-3 py-2 bg-muted/50 rounded-md border border-border">
                      <code className="text-sm text-muted-foreground break-all">
                        {editResource?.resource_url}
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      URL cannot be changed for external resources
                    </p>
                  </div>

                  {/* Network (read-only) */}
                  <div>
                    <Label>Network</Label>
                    <div className="flex items-center gap-2 mt-1.5 px-3 py-2 bg-muted/50 rounded-md border border-border w-fit">
                      <ChainIcon
                        network={editResource?.network as NetworkType}
                        className="w-4 h-4"
                      />
                      <span className="text-sm capitalize">
                        {editResource?.network}
                      </span>
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <Label htmlFor="edit-name">Display Name *</Label>
                    <Input
                      id="edit-name"
                      placeholder="My Resource"
                      {...editForm.register("name")}
                      className={`mt-1.5 ${editForm.formState.errors.name ? "border-destructive" : ""}`}
                    />
                    <FieldError
                      message={editForm.formState.errors.name?.message}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      placeholder="What does this resource do?"
                      {...editForm.register("description")}
                      className="mt-1.5"
                      rows={2}
                    />
                  </div>

                  {/* Image */}
                  <div>
                    <Label>Image</Label>
                    <div className="mt-1.5">
                      <ImageUrlOrUpload
                        value={editForm.watch("avatarUrl") || ""}
                        onChange={(val) => editForm.setValue("avatarUrl", val)}
                        placeholder="https://example.com/image.png"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <Label>Category</Label>
                    <Select
                      value={editForm.watch("category") || ""}
                      onChange={(val) => editForm.setValue("category", val)}
                      options={[...RESOURCE_CATEGORIES]}
                      placeholder="Select a category"
                      className="mt-1.5"
                    />
                  </div>
                </form>
              ) : (
                <>
                  {/* URL Input - only show when not verified */}
                  {!verified && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="external-url">Resource URL</Label>
                        <Input
                          id="external-url"
                          type="url"
                          placeholder="https://api.example.com/x402/..."
                          value={externalUrl}
                          onChange={(e) => {
                            setExternalUrl(e.target.value);
                            setVerified(null);
                            setError("");
                          }}
                          disabled={isVerifying}
                          className="mt-1.5"
                          autoFocus
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter the URL of your x402-enabled endpoint
                      </p>
                    </div>
                  )}

                  {/* Verified Resource Info */}
                  {verified && verifyResponse && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm">
                        <code className="flex-1 px-2 py-1 bg-muted rounded text-xs font-mono truncate">
                          {externalUrl}
                        </code>
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded ${verifyResponse.x402Version === 2 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                        >
                          v{verifyResponse.x402Version || 1}
                        </span>
                        <button
                          onClick={() => {
                            setVerified(null);
                            setVerifyResponse(null);
                          }}
                          className="text-muted-foreground hover:text-foreground text-xs underline"
                        >
                          Change
                        </button>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
                        <Check className="h-4 w-4 flex-shrink-0" />
                        Valid x402 endpoint found!
                      </div>

                      {warnings.length > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 dark:text-yellow-400 text-sm space-y-1">
                          <div className="flex items-center gap-2 font-medium">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            Validation warnings
                          </div>
                          <ul className="list-disc list-inside text-xs space-y-0.5 ml-6">
                            {warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {serverPreview && (
                        <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                          {serverPreview.faviconUrl ? (
                            <img
                              src={serverPreview.faviconUrl}
                              alt=""
                              className="w-8 h-8 rounded object-contain bg-background"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                              <Server className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {serverPreview.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {serverPreview.exists
                                ? `${serverPreview.resourceCount} existing resource${serverPreview.resourceCount === 1 ? "" : "s"}`
                                : "New server will be created"}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-3 bg-accent/50 border border-border rounded-lg">
                        {verified.avatarUrl || verified.extra?.avatarUrl ? (
                          <img
                            src={
                              (verified.avatarUrl ||
                                verified.extra?.avatarUrl) as string
                            }
                            alt=""
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-resource/20 flex items-center justify-center">
                            <Box className="w-6 h-6 text-resource" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const displayName =
                              verified.extra?.agentName ||
                              verified.serviceName ||
                              verified.extra?.serviceName ||
                              resourceName;
                            const showDescription =
                              verified.description &&
                              verified.description !== displayName;
                            return (
                              <>
                                <p className="font-semibold truncate">
                                  {displayName}
                                </p>
                                {showDescription && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {verified.description}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {verifyResponse.accepts &&
                      verifyResponse.accepts.length > 1 ? (
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">
                            Select payment network(s)
                          </span>
                          <div className="space-y-2">
                            {verifyResponse.accepts.map((accept) => {
                              const net = getNetwork(accept.normalizedNetwork);
                              const isSelected = selectedNetworks.includes(
                                accept.normalizedNetwork,
                              );
                              const price = accept.amount
                                ? parseFloat(accept.amount) / 1_000_000
                                : 0;
                              return (
                                <label
                                  key={accept.normalizedNetwork}
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedNetworks((prev) => [
                                          ...prev,
                                          accept.normalizedNetwork,
                                        ]);
                                      } else {
                                        setSelectedNetworks((prev) =>
                                          prev.filter(
                                            (n) =>
                                              n !== accept.normalizedNetwork,
                                          ),
                                        );
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-border"
                                  />
                                  <div className="flex-1">
                                    <span className="font-medium">
                                      {net.name}
                                    </span>
                                    <span className="text-muted-foreground ml-2">
                                      ${price.toFixed(2)} USDC
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Price</span>
                          <p className="font-mono">
                            {priceDisplay} USDC (
                            {getNetwork(verified.network).name})
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2b: Proxy Creation/Edit Form */}
          {step === "form" && resourceType === "proxy" && (
            <form
              onSubmit={
                isEditMode
                  ? editForm.handleSubmit(handleUpdate)
                  : proxyForm.handleSubmit(handleCreateProxy)
              }
              className="space-y-4"
            >
              {/* Resource URL - shown in edit mode */}
              {isEditMode && editResource?.resource_url && (
                <div>
                  <Label>Resource URL</Label>
                  <div className="mt-1.5 px-3 py-2 bg-muted/50 rounded-md border border-border">
                    <code className="text-sm text-muted-foreground break-all">
                      {editResource.resource_url}
                    </code>
                  </div>
                </div>
              )}

              {/* Network Selection */}
              <div>
                <Label>
                  Network{" "}
                  {isEditMode && (
                    <span className="text-xs text-muted-foreground">
                      (cannot be changed)
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  {(["base", "solana"] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => {
                        if (!isEditMode) {
                          proxyForm.setValue("network", net);
                          // Re-check slug availability for new network
                          const currentSlug = proxyForm.getValues("slug");
                          if (currentSlug) {
                            debouncedSlugCheck(currentSlug, net);
                          }
                        }
                      }}
                      disabled={isEditMode}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        (isEditMode
                          ? editResource?.network
                          : proxyForm.watch("network")) === net
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      } ${isEditMode ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <ChainIcon network={net} className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">
                        {net}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <Label htmlFor="proxy-name">Name *</Label>
                <Input
                  id="proxy-name"
                  placeholder="My Awesome API"
                  {...(isEditMode
                    ? editForm.register("name")
                    : {
                        ...proxyForm.register("name"),
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          proxyForm.setValue("name", e.target.value, {
                            shouldValidate: true,
                          });
                          handleNameChange(e.target.value);
                        },
                      })}
                  className={`mt-1.5 ${(isEditMode ? editForm.formState.errors.name : proxyForm.formState.errors.name) ? "border-destructive" : ""}`}
                />
                <FieldError
                  message={
                    (isEditMode
                      ? editForm.formState.errors.name
                      : proxyForm.formState.errors.name
                    )?.message
                  }
                />
              </div>

              {/* Slug - only for create mode */}
              {!isEditMode && (
                <div>
                  <Label htmlFor="proxy-slug">
                    <span>URL Slug *</span>
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      Your resource will be at: /@username/
                      {proxyForm.watch("slug") || "..."}
                    </span>
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <Input
                        id="proxy-slug"
                        placeholder="my-awesome-api"
                        {...proxyForm.register("slug", {
                          onChange: (e) => {
                            slugManuallyEdited.current = true;
                            const val = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "");
                            proxyForm.setValue("slug", val, {
                              shouldValidate: true,
                            });
                            debouncedSlugCheck(
                              val,
                              proxyForm.getValues("network"),
                            );
                          },
                        })}
                        className={`pr-10 ${proxyForm.formState.errors.slug || (slugStatus && !slugStatus.available) ? "border-destructive" : slugStatus?.available ? "border-primary" : ""}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingSlug && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingSlug && slugStatus?.available && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        {!isCheckingSlug &&
                          slugStatus &&
                          !slugStatus.available && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => regenerateSlug("proxy")}
                      className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
                      title="Regenerate from name"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  {proxyForm.formState.errors.slug && (
                    <FieldError
                      message={proxyForm.formState.errors.slug.message}
                    />
                  )}
                  {!proxyForm.formState.errors.slug &&
                    slugStatus &&
                    !slugStatus.available && (
                      <p className="text-xs text-destructive mt-1">
                        {slugStatus.reason}
                      </p>
                    )}
                  {!proxyForm.formState.errors.slug &&
                    slugStatus?.available && (
                      <p className="text-xs text-primary mt-1">
                        Slug is available
                      </p>
                    )}
                </div>
              )}

              {/* Description */}
              <div>
                <Label htmlFor="proxy-description">Description</Label>
                <Textarea
                  id="proxy-description"
                  placeholder="What does this resource do?"
                  {...(isEditMode
                    ? editForm.register("description")
                    : proxyForm.register("description"))}
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              {/* Image */}
              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUrlOrUpload
                    value={
                      (isEditMode
                        ? editForm.watch("avatarUrl")
                        : proxyForm.watch("avatarUrl")) || ""
                    }
                    onChange={(val) =>
                      isEditMode
                        ? editForm.setValue("avatarUrl", val)
                        : proxyForm.setValue("avatarUrl", val)
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <Label>Category {!isEditMode && "*"}</Label>
                <Select
                  value={
                    (isEditMode
                      ? editForm.watch("category")
                      : proxyForm.watch("category")) || ""
                  }
                  onChange={(val) =>
                    isEditMode
                      ? editForm.setValue("category", val)
                      : proxyForm.setValue("category", val)
                  }
                  options={[...RESOURCE_CATEGORIES]}
                  placeholder="Select a category"
                  className={`mt-1.5 ${!isEditMode && proxyForm.formState.errors.category ? "border-destructive" : ""}`}
                />
                {!isEditMode && (
                  <FieldError
                    message={proxyForm.formState.errors.category?.message}
                  />
                )}
              </div>

              {/* Proxy-specific fields - only shown for new resources */}
              {!isEditMode && (
                <>
                  {/* Price */}
                  <div>
                    <Label htmlFor="proxy-price">Price (USDC) *</Label>
                    <Input
                      id="proxy-price"
                      type="number"
                      step="0.001"
                      min="0.001"
                      placeholder="0.01"
                      {...proxyForm.register("priceUsdc")}
                      className={`mt-1.5 ${proxyForm.formState.errors.priceUsdc ? "border-destructive" : ""}`}
                    />
                    <FieldError
                      message={proxyForm.formState.errors.priceUsdc?.message}
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    {/* Origin URL */}
                    <div className="mb-4">
                      <Label htmlFor="proxy-origin">Origin URL *</Label>
                      <Input
                        id="proxy-origin"
                        placeholder="https://api.example.com/endpoint"
                        {...proxyForm.register("proxyOriginUrl")}
                        className={`mt-1.5 ${proxyForm.formState.errors.proxyOriginUrl ? "border-destructive" : ""}`}
                      />
                      <FieldError
                        message={
                          proxyForm.formState.errors.proxyOriginUrl?.message
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        The URL your requests will be forwarded to
                      </p>
                    </div>

                    {/* HTTP Method */}
                    <div className="mb-4">
                      <Label>HTTP Method</Label>
                      <div className="flex gap-2 mt-1.5">
                        {(["GET", "POST", "PASS"] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() =>
                              proxyForm.setValue("proxyMethod", method)
                            }
                            className={`px-4 py-2 rounded-lg border text-sm ${proxyForm.watch("proxyMethod") === method ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        PASS forwards the original request method
                      </p>
                    </div>

                    {/* Auth Header */}
                    <div className="mb-4">
                      <Label htmlFor="proxy-auth">Auth Header (optional)</Label>
                      <Input
                        id="proxy-auth"
                        type="password"
                        placeholder="Authorization: Bearer sk-..."
                        {...proxyForm.register("proxyAuthHeader")}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Format: Header-Name: value (encrypted at rest)
                      </p>
                    </div>

                    {/* Timeout */}
                    <div>
                      <Label htmlFor="proxy-timeout">Timeout (ms)</Label>
                      <Input
                        id="proxy-timeout"
                        type="number"
                        placeholder="30000"
                        {...proxyForm.register("proxyTimeoutMs")}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Step 2c: Prompt Template Creation/Edit Form */}
          {step === "form" && resourceType === "prompt_template" && (
            <form className="space-y-4">
              {/* Claude Integration Warning - only in create mode */}
              {!isEditMode &&
                claudeIntegration &&
                !claudeIntegration.hasApiKey && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You need to configure your Claude API key before creating
                      prompt templates.{" "}
                      <NextLink
                        href="/dashboard/integrations"
                        className="text-primary hover:underline font-medium"
                      >
                        Configure in Settings
                      </NextLink>
                    </AlertDescription>
                  </Alert>
                )}

              {/* Network Selection - read-only in edit mode */}
              <div>
                <Label>
                  Network{" "}
                  {isEditMode && (
                    <span className="text-xs text-muted-foreground">
                      (cannot be changed)
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  {(["base", "solana"] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => {
                        if (!isEditMode) {
                          promptTemplateForm.setValue("network", net);
                          // Re-check slug availability for new network
                          const currentSlug =
                            promptTemplateForm.getValues("slug");
                          if (currentSlug) {
                            debouncedSlugCheck(currentSlug, net);
                          }
                        }
                      }}
                      disabled={isEditMode}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        promptTemplateForm.watch("network") === net
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      } ${isEditMode ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <ChainIcon network={net} className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">
                        {net}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <Label htmlFor="pt-name">Name *</Label>
                <Input
                  id="pt-name"
                  placeholder="My AI Template"
                  {...promptTemplateForm.register("name", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      promptTemplateForm.setValue("name", e.target.value, {
                        shouldValidate: true,
                      });
                      if (!isEditMode) {
                        handleNameChange(e.target.value, "prompt_template");
                      }
                    },
                  })}
                  className={`mt-1.5 ${promptTemplateForm.formState.errors.name ? "border-destructive" : ""}`}
                />
                <FieldError
                  message={promptTemplateForm.formState.errors.name?.message}
                />
              </div>

              {/* Slug - only shown in create mode */}
              {!isEditMode && (
                <div>
                  <Label htmlFor="pt-slug">
                    <span>URL Slug *</span>
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      Your template will be at: /@username/
                      {promptTemplateForm.watch("slug") || "..."}
                    </span>
                  </Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="relative flex-1">
                      <Input
                        id="pt-slug"
                        placeholder="my-ai-template"
                        {...promptTemplateForm.register("slug", {
                          onChange: (e) => {
                            slugManuallyEdited.current = true;
                            const val = e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "");
                            promptTemplateForm.setValue("slug", val, {
                              shouldValidate: true,
                            });
                            debouncedSlugCheck(
                              val,
                              promptTemplateForm.getValues("network"),
                            );
                          },
                        })}
                        className={`pr-10 ${promptTemplateForm.formState.errors.slug || (slugStatus && !slugStatus.available) ? "border-destructive" : slugStatus?.available ? "border-primary" : ""}`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingSlug && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!isCheckingSlug && slugStatus?.available && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        {!isCheckingSlug &&
                          slugStatus &&
                          !slugStatus.available && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => regenerateSlug("prompt_template")}
                      className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
                      title="Regenerate from name"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  {promptTemplateForm.formState.errors.slug && (
                    <FieldError
                      message={promptTemplateForm.formState.errors.slug.message}
                    />
                  )}
                  {!promptTemplateForm.formState.errors.slug &&
                    slugStatus &&
                    !slugStatus.available && (
                      <p className="text-xs text-destructive mt-1">
                        {slugStatus.reason}
                      </p>
                    )}
                  {!promptTemplateForm.formState.errors.slug &&
                    slugStatus?.available && (
                      <p className="text-xs text-primary mt-1">
                        Slug is available
                      </p>
                    )}
                </div>
              )}

              {/* Resource URL - show in edit mode */}
              {isEditMode && editResource?.resource_url && (
                <div>
                  <Label>Resource URL</Label>
                  <div className="mt-1.5 px-3 py-2 bg-muted/50 rounded-md border border-border">
                    <code className="text-sm text-muted-foreground break-all">
                      {editResource.resource_url}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    URL cannot be changed after creation
                  </p>
                </div>
              )}

              {/* Description */}
              <div>
                <Label htmlFor="pt-description">Description</Label>
                <Textarea
                  id="pt-description"
                  placeholder="What does this template do?"
                  {...promptTemplateForm.register("description")}
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              {/* Image */}
              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUrlOrUpload
                    value={promptTemplateForm.watch("avatar_url") || ""}
                    onChange={(val) =>
                      promptTemplateForm.setValue("avatar_url", val)
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <Label>Category *</Label>
                <Select
                  value={promptTemplateForm.watch("category") || ""}
                  onChange={(val) =>
                    promptTemplateForm.setValue("category", val)
                  }
                  options={[...RESOURCE_CATEGORIES]}
                  placeholder="Select a category"
                  className={`mt-1.5 ${promptTemplateForm.formState.errors.category ? "border-destructive" : ""}`}
                />
                <FieldError
                  message={
                    promptTemplateForm.formState.errors.category?.message
                  }
                />
              </div>

              {/* Price */}
              <div>
                <Label htmlFor="pt-price">Price (USDC) *</Label>
                <Input
                  id="pt-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.01"
                  {...promptTemplateForm.register("price_usdc")}
                  className={`mt-1.5 ${promptTemplateForm.formState.errors.price_usdc ? "border-destructive" : ""}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum price is $0.01
                </p>
                <FieldError
                  message={
                    promptTemplateForm.formState.errors.price_usdc?.message
                  }
                />
              </div>

              {/* System Prompt Editor */}
              <div className="border-t border-border pt-4 space-y-2">
                <Label htmlFor="system-prompt">System Prompt *</Label>
                <p className="text-xs text-muted-foreground">
                  Use{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    {"{paramName}{/paramName}"}
                  </code>{" "}
                  to mark parameter placeholders
                </p>
                <Textarea
                  id="system-prompt"
                  {...promptTemplateForm.register("system_prompt")}
                  className="font-mono text-sm min-h-[200px] resize-y"
                  placeholder="You are a helpful assistant that specializes in {topic}{/topic}..."
                />

                {/* Tag status indicators - displays extracted tags below editor with visual styling */}
                <div className="flex justify-between items-start gap-4 text-xs">
                  {/* Tags used */}
                  <div className="flex-1">
                    {(() => {
                      const systemPrompt =
                        promptTemplateForm.watch("system_prompt") || "";
                      const tags = extractParameterTags(systemPrompt);
                      const params =
                        promptTemplateForm.watch("parameters") || [];
                      const paramNames = params
                        .map((p) => p.name)
                        .filter(Boolean);
                      const undefinedTags = findUndefinedTags(
                        systemPrompt,
                        paramNames,
                      );
                      const unusedParams = findUnusedParameters(
                        systemPrompt,
                        paramNames,
                      );

                      return (
                        <>
                          {tags.length > 0 ? (
                            <span className="text-muted-foreground">
                              Tags:{" "}
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`mx-0.5 px-1.5 py-0.5 rounded ${
                                    undefinedTags.includes(tag)
                                      ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              No parameter tags found
                            </span>
                          )}

                          {undefinedTags.length > 0 && (
                            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                              Warning: Tags without parameters:{" "}
                              {undefinedTags.join(", ")}
                            </p>
                          )}

                          {unusedParams.length > 0 && (
                            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                              Warning: Unused parameters:{" "}
                              {unusedParams.join(", ")}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Character count */}
                  <span className="text-muted-foreground">
                    {(promptTemplateForm.watch("system_prompt") || "").length}{" "}
                    characters
                  </span>
                </div>

                <FieldError
                  message={
                    promptTemplateForm.formState.errors.system_prompt?.message
                  }
                />
              </div>

              {/* Parameters Section */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Parameters</Label>
                    <p className="text-xs text-muted-foreground">
                      Define input fields that callers will fill in
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendParameter({
                        name: "",
                        description: "",
                        required: true,
                        default: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Parameter
                  </Button>
                </div>

                {parameterFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                    No parameters defined. Add parameters to let callers
                    customize the prompt.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {parameterFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-3 border border-border rounded-lg space-y-3 bg-muted/30"
                      >
                        <div className="flex items-start gap-3">
                          {/* Name and Description */}
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Parameter name (e.g., topic)"
                              {...promptTemplateForm.register(
                                `parameters.${index}.name`,
                              )}
                              className={
                                promptTemplateForm.formState.errors
                                  .parameters?.[index]?.name
                                  ? "border-destructive"
                                  : ""
                              }
                            />
                            <Input
                              placeholder="Description (optional)"
                              {...promptTemplateForm.register(
                                `parameters.${index}.description`,
                              )}
                            />
                          </div>

                          {/* Remove button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeParameter(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Required checkbox and Default value */}
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={promptTemplateForm.watch(
                                `parameters.${index}.required`,
                              )}
                              onChange={(e) =>
                                promptTemplateForm.setValue(
                                  `parameters.${index}.required`,
                                  e.target.checked,
                                )
                              }
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-muted-foreground">
                              Required
                            </span>
                          </label>

                          <div className="flex-1">
                            <Input
                              placeholder="Default value (optional)"
                              {...promptTemplateForm.register(
                                `parameters.${index}.default`,
                              )}
                              disabled={promptTemplateForm.watch(
                                `parameters.${index}.required`,
                              )}
                              className={
                                promptTemplateForm.watch(
                                  `parameters.${index}.required`,
                                )
                                  ? "opacity-50"
                                  : ""
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Template Settings */}
              <div className="border-t border-border pt-4 space-y-4">
                <Label>Template Settings</Label>

                {/* Max Tokens */}
                <div>
                  <Label htmlFor="max-tokens" className="text-sm font-normal">
                    Max Tokens
                  </Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min={1}
                    max={8192}
                    {...promptTemplateForm.register("max_tokens", {
                      valueAsNumber: true,
                    })}
                    className="mt-1.5 w-32"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum response length (1-8192)
                  </p>
                  <FieldError
                    message={
                      promptTemplateForm.formState.errors.max_tokens?.message
                    }
                  />
                </div>

                {/* User Input */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm font-normal">User Input</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow additional input from users
                    </p>
                  </div>
                  <Switch
                    checked={promptTemplateForm.watch("allows_user_message")}
                    onCheckedChange={(checked) =>
                      promptTemplateForm.setValue(
                        "allows_user_message",
                        checked,
                      )
                    }
                  />
                </div>
              </div>
            </form>
          )}

          {/* Step 2d: OpenRouter Resource Creation Form */}
          {step === "form" && resourceType === "openrouter_instant" && (
            <form className="space-y-4">
              {/* OpenRouter Integration Warning */}
              {openrouterIntegration && !openrouterIntegration.hasApiKey && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You need to configure your OpenRouter API key before
                    creating resources.{" "}
                    <NextLink
                      href="/dashboard/integrations"
                      className="text-primary hover:underline font-medium"
                    >
                      Configure in Settings
                    </NextLink>
                  </AlertDescription>
                </Alert>
              )}

              {/* Network Selection */}
              <div>
                <Label>Network</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  {(["base", "solana"] as const).map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => {
                        openrouterForm.setValue("network", net);
                        const currentSlug = openrouterForm.getValues("slug");
                        if (currentSlug) {
                          debouncedSlugCheck(currentSlug, net);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        openrouterForm.watch("network") === net
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <ChainIcon network={net} className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">
                        {net}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <Label>Model *</Label>
                {selectedModel ? (
                  <div className="mt-1.5 p-3 border border-border rounded-lg flex items-center justify-between bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-medium">
                          {selectedModel.display_name}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          ({selectedModel.provider})
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowModelBrowser(true)}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-1.5 w-full justify-start text-muted-foreground"
                    onClick={() => setShowModelBrowser(true)}
                  >
                    <Box className="w-4 h-4 mr-2" />
                    Select a model...
                  </Button>
                )}
                {openrouterForm.formState.errors.model_id && (
                  <FieldError message="Please select a model" />
                )}
              </div>

              {/* Model Browser Dialog */}
              {showModelBrowser && (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <h3 className="font-semibold">Select Model</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowModelBrowser(false)}
                      >
                        Close
                      </Button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1">
                      <ModelBrowser
                        selectedModelId={selectedModel?.id}
                        onSelect={(model) => {
                          setSelectedModel(model);
                          openrouterForm.setValue("model_id", model.id);
                          // Set default max_tokens based on model context length
                          if (model.context_length) {
                            const defaultMax = Math.min(
                              model.context_length / 4,
                              4096,
                            );
                            openrouterForm.setValue("max_tokens", defaultMax);
                          }
                          setShowModelBrowser(false);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <Label htmlFor="or-name">Name *</Label>
                <Input
                  id="or-name"
                  placeholder="My AI Assistant"
                  {...openrouterForm.register("name", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      openrouterForm.setValue("name", e.target.value, {
                        shouldValidate: true,
                      });
                      handleNameChange(e.target.value, "openrouter_instant");
                    },
                  })}
                  className={`mt-1.5 ${openrouterForm.formState.errors.name ? "border-destructive" : ""}`}
                />
                <FieldError
                  message={openrouterForm.formState.errors.name?.message}
                />
              </div>

              {/* Slug */}
              <div>
                <Label htmlFor="or-slug">
                  <span>URL Slug *</span>
                  <span className="text-xs text-muted-foreground ml-2 font-normal">
                    Your resource will be at: /@username/
                    {openrouterForm.watch("slug") || "..."}
                  </span>
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <Input
                      id="or-slug"
                      placeholder="my-ai-assistant"
                      {...openrouterForm.register("slug", {
                        onChange: (e) => {
                          slugManuallyEdited.current = true;
                          const val = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, "");
                          openrouterForm.setValue("slug", val, {
                            shouldValidate: true,
                          });
                          debouncedSlugCheck(
                            val,
                            openrouterForm.getValues("network"),
                          );
                        },
                      })}
                      className={`pr-10 ${openrouterForm.formState.errors.slug || (slugStatus && !slugStatus.available) ? "border-destructive" : slugStatus?.available ? "border-primary" : ""}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isCheckingSlug && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!isCheckingSlug && slugStatus?.available && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                      {!isCheckingSlug &&
                        slugStatus &&
                        !slugStatus.available && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => regenerateSlug("openrouter_instant")}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
                    title="Regenerate from name"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                {openrouterForm.formState.errors.slug && (
                  <FieldError
                    message={openrouterForm.formState.errors.slug.message}
                  />
                )}
                {!openrouterForm.formState.errors.slug &&
                  slugStatus &&
                  !slugStatus.available && (
                    <p className="text-xs text-destructive mt-1">
                      {slugStatus.reason}
                    </p>
                  )}
                {!openrouterForm.formState.errors.slug &&
                  slugStatus?.available && (
                    <p className="text-xs text-primary mt-1">
                      Slug is available
                    </p>
                  )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="or-description">Description</Label>
                <Textarea
                  id="or-description"
                  placeholder="What does this resource do?"
                  {...openrouterForm.register("description")}
                  className="mt-1.5"
                  rows={2}
                />
              </div>

              {/* Image */}
              <div>
                <Label>Image (optional)</Label>
                <div className="mt-1.5">
                  <ImageUrlOrUpload
                    value={openrouterForm.watch("avatar_url") || ""}
                    onChange={(val) =>
                      openrouterForm.setValue("avatar_url", val)
                    }
                    placeholder="https://example.com/image.png"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <Label>Category *</Label>
                <Select
                  value={openrouterForm.watch("category") || ""}
                  onChange={(val) => openrouterForm.setValue("category", val)}
                  options={[...RESOURCE_CATEGORIES]}
                  placeholder="Select a category"
                  className={`mt-1.5 ${openrouterForm.formState.errors.category ? "border-destructive" : ""}`}
                />
                <FieldError
                  message={openrouterForm.formState.errors.category?.message}
                />
              </div>

              {/* Price */}
              <div>
                <Label htmlFor="or-price">Price (USDC) *</Label>
                <Input
                  id="or-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.01"
                  {...openrouterForm.register("price_usdc")}
                  className={`mt-1.5 ${openrouterForm.formState.errors.price_usdc ? "border-destructive" : ""}`}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your markup on top of model costs. Minimum $0.01
                </p>
                <FieldError
                  message={openrouterForm.formState.errors.price_usdc?.message}
                />
              </div>

              {/* System Prompt Editor with {{param}} syntax detection */}
              <div className="border-t border-border pt-4 space-y-2">
                <Label htmlFor="or-system-prompt">System Prompt *</Label>
                <p className="text-xs text-muted-foreground">
                  Use{" "}
                  <code className="px-1 py-0.5 bg-muted rounded">
                    {"{paramName}{/paramName}"}
                  </code>{" "}
                  to mark parameter placeholders. Tags are detected and shown
                  below.
                </p>
                <Textarea
                  id="or-system-prompt"
                  {...openrouterForm.register("system_prompt")}
                  className="font-mono text-sm min-h-[200px] resize-y"
                  placeholder="You are a helpful assistant that specializes in {topic}{/topic}..."
                />

                {/* Tag status indicators - visual feedback for detected parameters */}
                <div className="flex justify-between items-start gap-4 text-xs">
                  <div className="flex-1">
                    {(() => {
                      const systemPrompt =
                        openrouterForm.watch("system_prompt") || "";
                      const tags = extractParameterTags(systemPrompt);
                      const params = openrouterForm.watch("parameters") || [];
                      const paramNames = params
                        .map((p) => p.name)
                        .filter(Boolean);
                      const undefinedTags = findUndefinedTags(
                        systemPrompt,
                        paramNames,
                      );
                      const unusedParams = findUnusedParameters(
                        systemPrompt,
                        paramNames,
                      );

                      return (
                        <>
                          {tags.length > 0 ? (
                            <span className="text-muted-foreground">
                              Tags:{" "}
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className={`mx-0.5 px-1.5 py-0.5 rounded ${
                                    undefinedTags.includes(tag)
                                      ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                  }`}
                                >
                                  {tag}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              No parameter tags found
                            </span>
                          )}
                          {undefinedTags.length > 0 && (
                            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                              Warning: Tags without parameters:{" "}
                              {undefinedTags.join(", ")}
                            </p>
                          )}
                          {unusedParams.length > 0 && (
                            <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                              Warning: Unused parameters:{" "}
                              {unusedParams.join(", ")}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <span className="text-muted-foreground">
                    {(openrouterForm.watch("system_prompt") || "").length}{" "}
                    characters
                  </span>
                </div>
                <FieldError
                  message={
                    openrouterForm.formState.errors.system_prompt?.message
                  }
                />
              </div>

              {/* Parameters Section - following exact Claude pattern */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Parameters</Label>
                    <p className="text-xs text-muted-foreground">
                      Define input fields that callers will fill in
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendOrParameter({
                        name: "",
                        description: "",
                        required: true,
                        default: "",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Parameter
                  </Button>
                </div>

                {orParameterFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                    No parameters defined. Add parameters to let callers
                    customize the prompt.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orParameterFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="p-3 border border-border rounded-lg space-y-3 bg-muted/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Parameter name (e.g., topic)"
                              {...openrouterForm.register(
                                `parameters.${index}.name`,
                              )}
                              className={
                                openrouterForm.formState.errors.parameters?.[
                                  index
                                ]?.name
                                  ? "border-destructive"
                                  : ""
                              }
                            />
                            <Input
                              placeholder="Description (optional)"
                              {...openrouterForm.register(
                                `parameters.${index}.description`,
                              )}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrParameter(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={openrouterForm.watch(
                                `parameters.${index}.required`,
                              )}
                              onChange={(e) =>
                                openrouterForm.setValue(
                                  `parameters.${index}.required`,
                                  e.target.checked,
                                )
                              }
                              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm text-muted-foreground">
                              Required
                            </span>
                          </label>
                          <div className="flex-1">
                            <Input
                              placeholder="Default value (optional)"
                              {...openrouterForm.register(
                                `parameters.${index}.default`,
                              )}
                              disabled={openrouterForm.watch(
                                `parameters.${index}.required`,
                              )}
                              className={
                                openrouterForm.watch(
                                  `parameters.${index}.required`,
                                )
                                  ? "opacity-50"
                                  : ""
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Settings */}
              <div className="border-t border-border pt-4 space-y-4">
                <Label>Model Settings</Label>

                {/* Temperature */}
                <div>
                  <Label
                    htmlFor="or-temperature"
                    className="text-sm font-normal"
                  >
                    Temperature
                  </Label>
                  <Input
                    id="or-temperature"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    {...openrouterForm.register("temperature", {
                      valueAsNumber: true,
                    })}
                    className="mt-1.5 w-32"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Controls randomness (0-2). Lower = more focused, higher =
                    more creative.
                  </p>
                </div>

                {/* Max Tokens */}
                <div>
                  <Label
                    htmlFor="or-max-tokens"
                    className="text-sm font-normal"
                  >
                    Max Tokens
                  </Label>
                  <Input
                    id="or-max-tokens"
                    type="number"
                    min={1}
                    max={128000}
                    {...openrouterForm.register("max_tokens", {
                      valueAsNumber: true,
                    })}
                    className="mt-1.5 w-32"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum response length.{" "}
                    {selectedModel?.context_length
                      ? `Model supports up to ${selectedModel.context_length.toLocaleString()} tokens.`
                      : ""}
                  </p>
                </div>

                {/* User Input */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label className="text-sm font-normal">User Input</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow additional input from users
                    </p>
                  </div>
                  <Switch
                    checked={openrouterForm.watch("allows_user_message")}
                    onCheckedChange={(checked) =>
                      openrouterForm.setValue("allows_user_message", checked)
                    }
                  />
                </div>
              </div>
            </form>
          )}
        </DialogBody>

        <DialogFooter>
          {step === "select" && (
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === "form" && resourceType === "external" && (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              {isEditMode ? (
                <Button
                  onClick={editForm.handleSubmit(handleUpdate)}
                  disabled={isSubmitting || !editForm.formState.isValid}
                  variant="primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              ) : !verified ? (
                <Button
                  onClick={handleVerify}
                  disabled={!externalUrl.trim() || isVerifying}
                  variant="primary"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    "Verify URL"
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleRegisterExternal}
                  disabled={isSubmitting || selectedNetworks.length === 0}
                  variant="primary"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : selectedNetworks.length > 1 ? (
                    `Register ${selectedNetworks.length} Resources`
                  ) : (
                    "Register Resource"
                  )}
                </Button>
              )}
            </>
          )}

          {step === "form" && resourceType === "proxy" && (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={
                  isEditMode
                    ? editForm.handleSubmit(handleUpdate)
                    : proxyForm.handleSubmit(handleCreateProxy)
                }
                disabled={
                  isSubmitting ||
                  (!isEditMode &&
                    (isCheckingSlug ||
                      (slugStatus !== null && !slugStatus.available)))
                }
                variant="primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {isEditMode ? "Saving..." : "Creating..."}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Create Resource"
                )}
              </Button>
            </>
          )}

          {step === "form" && resourceType === "prompt_template" && (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={
                  isEditMode
                    ? promptTemplateForm.handleSubmit(
                        handleUpdatePromptTemplate,
                      )
                    : promptTemplateForm.handleSubmit(
                        handleCreatePromptTemplate,
                      )
                }
                disabled={
                  isSubmitting ||
                  (!isEditMode &&
                    (isCheckingSlug ||
                      (slugStatus !== null && !slugStatus.available))) ||
                  // Require Claude integration in create mode
                  (!isEditMode &&
                    claudeIntegration &&
                    !claudeIntegration.hasApiKey)
                }
                variant="primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {isEditMode ? "Saving..." : "Creating..."}
                  </>
                ) : isEditMode ? (
                  "Save Changes"
                ) : (
                  "Create Template"
                )}
              </Button>
            </>
          )}

          {step === "form" && resourceType === "openrouter_instant" && (
            <>
              <Button
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={openrouterForm.handleSubmit(handleCreateOpenRouter)}
                disabled={
                  isSubmitting ||
                  isCheckingSlug ||
                  (slugStatus !== null && !slugStatus.available) ||
                  (openrouterIntegration && !openrouterIntegration.hasApiKey)
                }
                variant="primary"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Resource"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
