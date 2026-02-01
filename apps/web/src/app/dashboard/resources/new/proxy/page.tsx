"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@x402jobs/ui/input";
import { Button } from "@x402jobs/ui/button";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDraft, saveDraft } from "@/lib/wizard-draft";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

const proxySchema = z.object({
  originUrl: z
    .string()
    .min(1, "Origin URL is required")
    .url("Must be a valid URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PASS"]),
  authHeader: z.string().optional(),
});

type ProxyFormData = z.infer<typeof proxySchema>;

export default function ProxyConfigPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
    reset,
  } = useForm<ProxyFormData>({
    resolver: zodResolver(proxySchema),
    defaultValues: {
      originUrl: "",
      method: "POST",
      authHeader: "",
    },
  });

  // Deep link protection
  useEffect(() => {
    const draft = getDraft();
    if (!draft?.type || draft.type !== "proxy") {
      router.replace("/dashboard/resources/new");
      return;
    }

    // Restore from draft if exists
    if (draft.proxyConfig) {
      const config = draft.proxyConfig as {
        originUrl?: string;
        method?: "GET" | "POST" | "PUT" | "DELETE" | "PASS";
        authHeader?: string;
      };
      reset({
        originUrl: config.originUrl || "",
        method: config.method || "POST",
        authHeader: config.authHeader || "",
      });
    }

    setIsLoaded(true);
  }, [router, reset]);

  const method = watch("method");

  const handleContinue = (data: ProxyFormData) => {
    saveDraft({
      proxyConfig: {
        originUrl: data.originUrl,
        method: data.method,
        authHeader: data.authHeader || undefined,
      },
    });
    router.push("/dashboard/resources/new/details");
  };

  if (!isLoaded) return null;

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure Proxy"
      description="Set up your proxy endpoint"
      backHref="/dashboard/resources/new"
      footer={
        <Button
          type="submit"
          form="proxy-form"
          disabled={!isValid}
        >
          Continue
        </Button>
      }
    >
      <form
        id="proxy-form"
        onSubmit={handleSubmit(handleContinue)}
        className="space-y-6"
      >
        {/* Origin URL input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Origin URL <span className="text-destructive">*</span>
          </label>
          <Input
            {...register("originUrl")}
            placeholder="https://api.example.com/endpoint"
            autoFocus
          />
          {errors.originUrl && (
            <p className="text-sm text-destructive mt-1">
              {errors.originUrl.message}
            </p>
          )}
        </div>

        {/* HTTP Method button group */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            HTTP Method <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {(["GET", "POST", "PUT", "DELETE", "PASS"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                onClick={() => setValue("method", m, { shouldValidate: true })}
                className={
                  method === m
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:bg-accent"
                }
              >
                {m}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            PASS forwards the original request method
          </p>
          {errors.method && (
            <p className="text-sm text-destructive mt-1">
              {errors.method.message}
            </p>
          )}
        </div>

        {/* Auth Header in collapsible section */}
        <CollapsibleSection title="Authentication" defaultExpanded={false}>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Auth Header (optional)
            </label>
            <Input
              {...register("authHeader")}
              type="password"
              placeholder="Authorization: Bearer sk-..."
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              This header will be forwarded with every proxied request. Stored encrypted.
            </p>
            {errors.authHeader && (
              <p className="text-sm text-destructive mt-1">
                {errors.authHeader.message}
              </p>
            )}
          </div>
        </CollapsibleSection>
      </form>
    </WizardShell>
  );
}
