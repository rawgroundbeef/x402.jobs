"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Label } from "@x402jobs/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { ImageUrlOrUpload } from "@/components/inputs/ImageUrlOrUpload";
import {
  Loader2,
  Globe,
  MessageSquare,
  FileText,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  ArrowLeft,
  Play,
} from "lucide-react";

type ResourceType = "proxy" | "prompt" | "static";

interface PromptParameter {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description?: string;
  default?: string;
}

const RESOURCE_TYPE_ICONS = {
  proxy: Globe,
  prompt: MessageSquare,
  static: FileText,
};

const RESOURCE_TYPE_LABELS = {
  proxy: "URL",
  prompt: "Prompt",
  static: "Static",
};

export default function EditResourcePage() {
  const router = useRouter();
  const params = useParams();
  const resourceId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);

  // Common fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsdc, setPriceUsdc] = useState("0.01");
  const [network, setNetwork] = useState<"solana" | "base">("base");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");

  // URL fields
  const [proxyOriginUrl, setProxyOriginUrl] = useState("");
  const [proxyMethod, setProxyMethod] = useState<"GET" | "POST" | "PASS">(
    "POST",
  );
  const [proxyAuthHeader, setProxyAuthHeader] = useState("");
  const [proxyTimeoutMs, setProxyTimeoutMs] = useState("30000");

  // Prompt fields
  const [promptApiKey, setPromptApiKey] = useState("");
  const [promptModel, setPromptModel] = useState("claude-3-haiku-20240307");
  const [promptSystemPrompt, setPromptSystemPrompt] = useState("");
  const [promptParameters, setPromptParameters] = useState<PromptParameter[]>(
    [],
  );
  const [promptOutputFormat, setPromptOutputFormat] = useState<"raw" | "json">(
    "raw",
  );

  // Static fields
  const [staticContent, setStaticContent] = useState("");
  const [staticContentType, setStaticContentType] =
    useState("application/json");

  // Usage stats
  const [usage, setUsage] = useState<{
    callCount: number;
    jobCount: number;
  } | null>(null);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Load resource data
  useEffect(() => {
    const fetchResource = async () => {
      try {
        const res = await authenticatedFetch(`/resources/${resourceId}`);
        if (!res.ok) {
          throw new Error("Failed to fetch resource");
        }
        const data = await res.json();
        const resource = data.resource;

        setResourceType(resource.resource_type);
        setName(resource.name || "");
        setDescription(resource.description || "");
        setPriceUsdc(resource.price_usdc?.toString() || "0.01");
        setNetwork(resource.network || "base");
        setAvatarUrl(resource.avatar_url || "");
        setResourceUrl(resource.resource_url || "");

        // Type-specific fields
        if (resource.resource_type === "proxy") {
          setProxyOriginUrl(resource.proxy_origin_url || "");
          setProxyMethod(resource.proxy_method || "POST");
          setProxyTimeoutMs(resource.proxy_timeout_ms?.toString() || "30000");
        }

        if (resource.resource_type === "prompt") {
          setPromptModel(resource.prompt_model || "claude-3-haiku-20240307");
          setPromptSystemPrompt(resource.prompt_system_prompt || "");
          setPromptParameters(resource.prompt_parameters || []);
          setPromptOutputFormat(resource.prompt_output_format || "raw");
        }

        if (resource.resource_type === "static") {
          setStaticContent(resource.static_content || "");
          setStaticContentType(
            resource.static_content_type || "application/json",
          );
        }

        // Load usage stats
        if (data.usage) {
          setUsage(data.usage);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load resource",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (resourceId && user) {
      fetchResource();
    }
  }, [resourceId, user]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?returnUrl=/dashboard/resources/${resourceId}/edit`);
    }
  }, [authLoading, user, router, resourceId]);

  const addParameter = () => {
    setPromptParameters([
      ...promptParameters,
      { name: "", type: "string", required: true, description: "" },
    ]);
  };

  const removeParameter = (index: number) => {
    setPromptParameters(promptParameters.filter((_, i) => i !== index));
  };

  const updateParameter = (
    index: number,
    field: keyof PromptParameter,
    value: any,
  ) => {
    setPromptParameters(
      promptParameters.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    );
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess(false);
    setIsSubmitting(true);

    try {
      if (!name.trim()) {
        throw new Error("Name is required");
      }
      if (!priceUsdc || parseFloat(priceUsdc) < 0.001) {
        throw new Error("Price must be at least $0.001");
      }

      const body: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        priceUsdc: parseFloat(priceUsdc),
        network,
        avatarUrl: avatarUrl.trim() || null,
      };

      if (resourceType === "proxy") {
        if (!proxyOriginUrl.trim()) {
          throw new Error("Origin URL is required");
        }
        body.proxyOriginUrl = proxyOriginUrl.trim();
        body.proxyMethod = proxyMethod;
        body.proxyAuthHeader = proxyAuthHeader.trim() || "";
        body.proxyTimeoutMs = parseInt(proxyTimeoutMs) || 30000;
      }

      if (resourceType === "prompt") {
        if (!promptSystemPrompt.trim()) {
          throw new Error("System prompt is required");
        }
        // Only send API key if changed (non-empty)
        if (promptApiKey.trim()) {
          body.promptApiKey = promptApiKey.trim();
        }
        body.promptModel = promptModel;
        body.promptSystemPrompt = promptSystemPrompt.trim();
        body.promptParameters =
          promptParameters.length > 0 ? promptParameters : null;
        body.promptOutputFormat = promptOutputFormat;
      }

      if (resourceType === "static") {
        if (!staticContent.trim()) {
          throw new Error("Content is required");
        }
        body.staticContent = staticContent;
        body.staticContentType = staticContentType;
      }

      const res = await authenticatedFetch(`/resources/${resourceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update resource");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update resource",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create a new job with this resource pre-connected
  const handleStartJob = async () => {
    setIsStartingJob(true);
    setError("");

    try {
      // Build resource data for the workflow node
      const price = parseFloat(priceUsdc) || 0.01;

      // Create workflow with trigger -> resource -> output
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
                id: resourceId,
                name: name,
                displayName: name,
                description: description,
                price: price,
                avatarUrl: avatarUrl,
                resourceUrl: resourceUrl,
                network: network,
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

      // Create the job
      const res = await authenticatedFetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${name} Job`,
          network: network,
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
      setError(err instanceof Error ? err.message : "Failed to start job");
      setIsStartingJob(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resourceType) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-semibold mb-2">Resource Not Found</h1>
          <p className="text-muted-foreground mb-4">
            {error || "Could not load this resource."}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/resources")}
          >
            Back to Resources
          </Button>
        </Card>
      </div>
    );
  }

  const Icon = RESOURCE_TYPE_ICONS[resourceType];
  const isLocked = !!(usage && usage.jobCount > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/resources")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Resource</h1>
            <div className="flex items-center gap-2 mt-1">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {RESOURCE_TYPE_LABELS[resourceType]} Resource
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleStartJob}
          disabled={isStartingJob}
          className="gap-2 bg-trigger hover:bg-trigger-dark text-white"
        >
          {isStartingJob ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Start Job
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-600 text-sm">
            Resource updated successfully!
          </p>
        </div>
      )}

      {/* Locked - Jobs Using Resource */}
      {usage && usage.jobCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-500 font-medium">Editing locked</p>
            <p className="text-amber-400 text-sm mt-1">
              This resource is used in {usage.jobCount} job
              {usage.jobCount > 1 ? "s" : ""}. Remove it from all jobs before
              editing.
            </p>
          </div>
        </div>
      )}

      {/* Usage Info - Calls Only (no jobs) */}
      {usage && usage.callCount > 0 && usage.jobCount === 0 && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-foreground font-medium">
              {usage.callCount.toLocaleString()} calls made
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              This resource has been used. Changes may affect existing
              integrations.
            </p>
          </div>
        </div>
      )}

      {/* Resource URL */}
      <Card className="p-4">
        <Label className="text-muted-foreground text-xs">Resource URL</Label>
        <code className="text-sm font-mono block mt-1">{resourceUrl}</code>
      </Card>

      {/* Common Fields */}
      <Card className="p-6 space-y-4">
        <h2 className="font-semibold">Basic Information</h2>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My API Resource"
            disabled={isLocked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this resource do?"
            rows={2}
            disabled={isLocked}
          />
        </div>

        <div className="space-y-2">
          <Label>Image (optional)</Label>
          <ImageUrlOrUpload
            value={avatarUrl}
            onChange={setAvatarUrl}
            placeholder="https://example.com/image.png"
            disabled={isLocked}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Price (USDC per call)</Label>
          <Input
            id="price"
            type="number"
            step="0.001"
            min="0.001"
            value={priceUsdc}
            onChange={(e) => setPriceUsdc(e.target.value)}
            disabled={isLocked}
          />
          <p className="text-xs text-muted-foreground">
            Platform fee: 10% ({(parseFloat(priceUsdc || "0") * 0.1).toFixed(4)}{" "}
            USDC)
          </p>
        </div>

        <div className="space-y-2">
          <Label>Network</Label>
          <div className="flex gap-3">
            {(["base", "solana"] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNetwork(n)}
                disabled={isLocked}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  network === n
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                } ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <ChainIcon network={n} className="w-5 h-5" />
                <span className="capitalize">{n}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* URL Fields */}
      {resourceType === "proxy" && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">URL Configuration</h2>

          <div className="space-y-2">
            <Label htmlFor="originUrl">Origin URL</Label>
            <Input
              id="originUrl"
              type="url"
              value={proxyOriginUrl}
              onChange={(e) => setProxyOriginUrl(e.target.value)}
              placeholder="https://api.example.com/endpoint"
              disabled={isLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">HTTP Method</Label>
            <select
              id="method"
              value={proxyMethod}
              onChange={(e) =>
                setProxyMethod(e.target.value as "GET" | "POST" | "PASS")
              }
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PASS">PASS (use caller's method)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="authHeader">Authorization Header (optional)</Label>
            <Input
              id="authHeader"
              type="password"
              value={proxyAuthHeader}
              onChange={(e) => setProxyAuthHeader(e.target.value)}
              placeholder="Authorization: Bearer sk-..."
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to keep existing. Format: "Header-Name: value"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={proxyTimeoutMs}
              onChange={(e) => setProxyTimeoutMs(e.target.value)}
              min="1000"
              max="300000"
              disabled={isLocked}
            />
          </div>
        </Card>
      )}

      {/* Prompt Fields */}
      {resourceType === "prompt" && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Prompt Configuration</h2>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Anthropic API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={promptApiKey}
              onChange={(e) => setPromptApiKey(e.target.value)}
              placeholder="Leave empty to keep existing key"
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">
              Only enter a new key if you want to change it
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <select
              id="model"
              value={promptModel}
              onChange={(e) => setPromptModel(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              <option value="claude-3-haiku-20240307">
                Claude 3 Haiku (fastest, cheapest)
              </option>
              <option value="claude-3-5-sonnet-20241022">
                Claude 3.5 Sonnet (balanced)
              </option>
              <option value="claude-3-5-haiku-20241022">
                Claude 3.5 Haiku (fast)
              </option>
              <option value="claude-sonnet-4-20250514">
                Claude Sonnet 4 (latest)
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={promptSystemPrompt}
              onChange={(e) => setPromptSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant that..."
              rows={4}
              disabled={isLocked}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputFormat">Output Format</Label>
            <select
              id="outputFormat"
              value={promptOutputFormat}
              onChange={(e) =>
                setPromptOutputFormat(e.target.value as "raw" | "json")
              }
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              <option value="raw">Raw text</option>
              <option value="json">JSON (parse response as JSON)</option>
            </select>
          </div>

          {/* Parameters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Input Parameters</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addParameter}
                disabled={isLocked}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {promptParameters.map((param, index) => (
              <div
                key={index}
                className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Parameter name"
                    value={param.name}
                    onChange={(e) =>
                      updateParameter(index, "name", e.target.value)
                    }
                    disabled={isLocked}
                  />
                  <div className="flex gap-2">
                    <select
                      value={param.type}
                      onChange={(e) =>
                        updateParameter(index, "type", e.target.value)
                      }
                      className="h-9 px-2 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isLocked}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                    </select>
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) =>
                          updateParameter(index, "required", e.target.checked)
                        }
                        disabled={isLocked}
                      />
                      Required
                    </label>
                  </div>
                  <Input
                    placeholder="Description (optional)"
                    value={param.description || ""}
                    onChange={(e) =>
                      updateParameter(index, "description", e.target.value)
                    }
                    disabled={isLocked}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeParameter(index)}
                  disabled={isLocked}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Static Fields */}
      {resourceType === "static" && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Static Content</h2>

          <div className="space-y-2">
            <Label htmlFor="contentType">Content Type</Label>
            <select
              id="contentType"
              value={staticContentType}
              onChange={(e) => setStaticContentType(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLocked}
            >
              <option value="application/json">JSON</option>
              <option value="text/plain">Plain Text</option>
              <option value="text/html">HTML</option>
              <option value="text/csv">CSV</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={staticContent}
              onChange={(e) => setStaticContent(e.target.value)}
              placeholder='{"key": "value"}'
              rows={8}
              className="font-mono text-sm"
              disabled={isLocked}
            />
          </div>
        </Card>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/resources")}
        >
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || isLocked}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
