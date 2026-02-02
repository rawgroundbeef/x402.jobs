"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Input } from "@x402jobs/ui/input";
import { Button } from "@x402jobs/ui/button";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDraft, saveDraft } from "@/lib/wizard-draft";
import {
  VerifyResultDetails,
  SectionLabel,
  ZoneCard,
} from "@/components/VerifyResultDetails";
import { processVerifyResponse } from "@/lib/x402-verify";
import { normalizeNetworkId } from "@/lib/networks";
import { API_URL } from "@/lib/api";
import type { VerifyResponse } from "@/lib/x402-verify";

const linkSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Must be a valid URL starting with https://"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
});

type LinkFormData = z.infer<typeof linkSchema>;

export default function LinkConfigPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [verifyResponse, setVerifyResponse] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deep link protection
  useEffect(() => {
    const draft = getDraft();
    if (!draft?.type || draft.type !== "link") {
      router.replace("/dashboard/resources/new");
      return;
    }
    setIsLoaded(true);
  }, [router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      url: "",
      method: "GET",
    },
  });

  const url = watch("url");
  const method = watch("method");

  // Clear validation results when URL or method changes
  useEffect(() => {
    if (url || method) {
      setVerifyResponse(null);
      setError(null);
    }
  }, [url, method]);

  // Validate endpoint
  const handleValidate = async (data: LinkFormData) => {
    setIsValidating(true);
    setError(null);
    setVerifyResponse(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/resources/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: data.url }),
      });

      if (!response.ok) {
        const rawData = await response.json().catch(() => ({}));
        if (rawData.validationErrors && Array.isArray(rawData.validationErrors)) {
          setError(rawData.validationErrors.join(". "));
        } else if (rawData.error) {
          setError(rawData.error);
        } else {
          setError("Validation failed");
        }
        return;
      }

      const rawData = await response.json();
      const processed = processVerifyResponse(rawData, data.url);
      setVerifyResponse(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate endpoint");
    } finally {
      setIsValidating(false);
    }
  };

  // Continue to details page
  const handleContinue = () => {
    if (!verifyResponse?.valid || !verifyResponse.checkResult) {
      return;
    }

    const summary = verifyResponse.checkResult.summary?.[0];
    if (!summary) {
      return;
    }

    // Normalize network
    const normalizedNetwork = normalizeNetworkId(summary.network) || "solana";

    // Convert price from lamports/wei to decimal
    const decimals = summary.assetDecimals || 6;
    const amountNum = parseInt(summary.amount, 10);
    const price = (amountNum / 10 ** decimals).toString();

    // Default image: resource avatar > server favicon > none
    const defaultImage =
      verifyResponse.resource.avatarUrl ||
      verifyResponse.server?.faviconUrl ||
      undefined;

    // Default name: service name > description (truncated) > URL path
    const endpointUrl = verifyResponse.normalizedUrl || url;
    let defaultName =
      verifyResponse.resource.serviceName ||
      verifyResponse.service?.name ||
      "";
    if (!defaultName) {
      try {
        const parsed = new URL(endpointUrl);
        // Use last meaningful path segment, e.g. "/stats/solana" → "Stats Solana"
        const segments = parsed.pathname.split("/").filter(Boolean);
        if (segments.length > 0) {
          defaultName = segments
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(" ");
        } else {
          defaultName = parsed.hostname.replace(/^(www|api)\./, "");
        }
      } catch {
        defaultName = "";
      }
    }

    // Default description from resource metadata
    const defaultDescription = verifyResponse.resource.description || "";

    // Generate slug from name
    const defaultSlug = defaultName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 60)
      .replace(/-$/, "");

    // Save to draft with pre-fill flags
    saveDraft({
      resourceUrl: endpointUrl,
      serverSlug: verifyResponse.server?.slug || undefined,
      name: defaultName,
      slug: defaultSlug,
      description: defaultDescription,
      network: normalizedNetwork,
      price: price,
      imageUrl: defaultImage,
      preFilled: { network: true, price: true },
      linkConfig: {
        url: verifyResponse.normalizedUrl || url,
        method: method,
        // Fields needed for POST /resources (external registration)
        payTo: verifyResponse.resource.payTo,
        maxAmountRequired: verifyResponse.resource.maxAmountRequired,
        asset: verifyResponse.resource.asset,
        mimeType: verifyResponse.resource.mimeType,
        maxTimeoutSeconds: verifyResponse.resource.maxTimeoutSeconds,
        outputSchema: verifyResponse.resource.outputSchema,
        isA2A: verifyResponse.resource.isA2A,
        supportsRefunds: false, // x402check does not extract this; default to false
        description: verifyResponse.resource.description,
        avatarUrl: verifyResponse.resource.avatarUrl,
      },
    });

    router.push("/dashboard/resources/new/details");
  };

  // Clear validation and show form again
  const handleChange = () => {
    setVerifyResponse(null);
    setError(null);
  };

  if (!isLoaded) return null;

  const canContinue = verifyResponse?.valid && !isValidating;

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Validate Endpoint"
      backHref="/dashboard/resources/new"
      footer={
        canContinue ? (
          <Button onClick={handleContinue} variant="primary">Continue</Button>
        ) : verifyResponse && !verifyResponse.valid ? (
          <>
            <span className="text-xs text-destructive dark:text-red-300">
              Fix {verifyResponse.checkResult?.errors.length ?? 0}{" "}
              {(verifyResponse.checkResult?.errors.length ?? 0) === 1 ? "error" : "errors"} to continue
            </span>
            <Button disabled>Continue</Button>
          </>
        ) : null
      }
    >
      {/* Zone 1: Endpoint — pre-validation form */}
      {!verifyResponse && (
        <>
          <SectionLabel>Endpoint</SectionLabel>
          <ZoneCard className="p-4">
            <form onSubmit={handleSubmit(handleValidate)}>
              <div className="flex gap-3">
                <select
                  {...register("method")}
                  className="w-[100px] appearance-none px-3 py-2 border border-input rounded-md bg-background text-sm h-9 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.25em 1.25em",
                    paddingRight: "2rem",
                  }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <Input
                  {...register("url")}
                  placeholder="https://api.example.com/x402/..."
                  className="flex-1"
                  autoFocus
                />
              </div>
              {(errors.url || errors.method) && (
                <div className="mt-2">
                  {errors.url && (
                    <p className="text-sm text-destructive">{errors.url.message}</p>
                  )}
                  {errors.method && (
                    <p className="text-sm text-destructive">{errors.method.message}</p>
                  )}
                </div>
              )}
              <div className="flex justify-end mt-3">
                <Button type="submit" variant="primary" disabled={isValidating}>
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Validate Endpoint"
                  )}
                </Button>
              </div>
            </form>
          </ZoneCard>
        </>
      )}

      {/* Error display (network/fetch errors) */}
      {error && !verifyResponse && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Zone 1: Endpoint — post-validation collapsed display */}
      {verifyResponse && (
        <>
          <SectionLabel>Endpoint</SectionLabel>
          <ZoneCard className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {method}
              </span>
              <span className="font-mono text-sm truncate flex-1 min-w-0">
                {url}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChange}
                className="flex-shrink-0"
              >
                Change
              </Button>
            </div>
          </ZoneCard>

          {/* Zones 2-5: Validation results */}
          <div className="mt-8">
            <VerifyResultDetails verifyResponse={verifyResponse} />
          </div>
        </>
      )}
    </WizardShell>
  );
}
