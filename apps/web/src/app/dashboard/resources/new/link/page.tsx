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
import { VerifyResultDetails } from "@/components/VerifyResultDetails";
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

    // Save to draft with pre-fill flags
    saveDraft({
      resourceUrl: verifyResponse.normalizedUrl || url,
      network: normalizedNetwork,
      price: price,
      preFilled: { network: true, price: true },
      linkConfig: {
        url: verifyResponse.normalizedUrl || url,
        method: method,
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
      description="Check your x402 endpoint configuration"
      backHref="/dashboard/resources/new"
      footer={
        <>
          {!verifyResponse ? (
            <Button
              type="submit"
              form="link-form"
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Validate Endpoint"
              )}
            </Button>
          ) : verifyResponse.valid ? (
            <Button
              onClick={handleContinue}
              disabled={!canContinue}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="submit"
              form="link-form"
              disabled={isValidating}
            >
              Validate Endpoint
            </Button>
          )}
        </>
      }
    >
      {/* Form (shown when no validation results) */}
      {!verifyResponse && (
        <form id="link-form" onSubmit={handleSubmit(handleValidate)} className="space-y-6">
          {/* URL input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Endpoint URL <span className="text-destructive">*</span>
            </label>
            <Input
              {...register("url")}
              placeholder="https://api.example.com/x402/..."
              autoFocus
            />
            {errors.url && (
              <p className="text-sm text-destructive mt-1">{errors.url.message}</p>
            )}
          </div>

          {/* HTTP Method dropdown */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              HTTP Method <span className="text-destructive">*</span>
            </label>
            <select
              {...register("method")}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm h-9"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            {errors.method && (
              <p className="text-sm text-destructive mt-1">{errors.method.message}</p>
            )}
          </div>
        </form>
      )}

      {/* Error display */}
      {error && !verifyResponse && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Validation results */}
      {verifyResponse && (
        <div className="space-y-4">
          {/* URL display with change button */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Endpoint URL</p>
              <p className="text-sm font-mono break-all">{url}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleChange}
              className="ml-3 flex-shrink-0"
            >
              Change
            </Button>
          </div>

          {/* Validation results component */}
          <VerifyResultDetails verifyResponse={verifyResponse} url={url} />
        </div>
      )}
    </WizardShell>
  );
}
