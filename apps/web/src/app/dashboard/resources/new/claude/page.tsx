"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import useSWR from "swr";
import Link from "next/link";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Button } from "@x402jobs/ui/button";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDraft, saveDraft } from "@/lib/wizard-draft";
import { authenticatedFetcher } from "@/lib/api";
import { promptTemplateParameterSchema } from "@/types/prompt-template";

interface ClaudeConfig {
  hasApiKey: boolean;
  isEnabled: boolean;
}

const claudeSchema = z.object({
  systemPrompt: z.string().min(1, "System prompt is required"),
  parameters: z.array(promptTemplateParameterSchema).default([]),
  maxTokens: z.number().int().min(1).max(64000).default(4096),
});

type ClaudeFormData = z.infer<typeof claudeSchema>;

export default function ClaudeConfigPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  // API key check
  const { data: configData, isLoading: isLoadingConfig } = useSWR<ClaudeConfig>(
    "/integrations/claude/config",
    authenticatedFetcher,
  );
  const hasApiKey = configData?.hasApiKey || false;

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isValid },
    reset,
  } = useForm<ClaudeFormData>({
    resolver: zodResolver(claudeSchema),
    mode: "onChange",
    defaultValues: {
      systemPrompt: "",
      parameters: [],
      maxTokens: 4096,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "parameters",
  });

  const systemPrompt = watch("systemPrompt");
  const prevParamNames = useRef<string[]>([]);

  // Auto-extract parameters from {paramName}{/paramName} in system prompt
  useEffect(() => {
    if (!systemPrompt) {
      prevParamNames.current = [];
      return;
    }
    const regex = /\{(\w+)\}\{\/\1\}/g;
    const found: string[] = [];
    let match;
    while ((match = regex.exec(systemPrompt)) !== null) {
      if (!found.includes(match[1])) found.push(match[1]);
    }

    const prev = prevParamNames.current;
    // Add new params that don't exist yet
    for (const name of found) {
      if (!fields.some((f) => f.name === name)) {
        append({ name, description: "", required: true, default: "" }, { shouldFocus: false });
      }
    }
    // Remove params that were auto-added but are no longer in the prompt
    // Only remove if the param was previously detected (not manually added)
    for (let i = fields.length - 1; i >= 0; i--) {
      const field = fields[i];
      if (prev.includes(field.name) && !found.includes(field.name)) {
        remove(i);
      }
    }
    prevParamNames.current = found;
  }, [systemPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep link protection and draft restoration
  useEffect(() => {
    const draft = getDraft();
    if (!draft?.type || draft.type !== "claude") {
      router.replace("/dashboard/resources/new");
      return;
    }

    // Restore from draft if exists
    if (draft.claudeConfig) {
      const config = draft.claudeConfig as {
        systemPrompt?: string;
        parameters?: Array<{
          name: string;
          description?: string;
          required?: boolean;
          default?: string;
        }>;
        maxTokens?: number;
      };
      reset({
        systemPrompt: config.systemPrompt || "",
        parameters: config.parameters || [],
        maxTokens: config.maxTokens || 4096,
      });
    }

    setIsLoaded(true);
  }, [router, reset]);

  const handleContinue = (data: ClaudeFormData) => {
    saveDraft({
      claudeConfig: {
        systemPrompt: data.systemPrompt,
        parameters: data.parameters,
        maxTokens: data.maxTokens,
      },
    });
    router.push("/dashboard/resources/new/details");
  };

  const canContinue = hasApiKey && isValid;

  if (!isLoaded) return null;

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure Prompt Template"
      backHref="/dashboard/resources/new"
      footer={
        <Button type="submit" form="claude-form" disabled={!canContinue}>
          Continue
        </Button>
      }
    >
      <form
        id="claude-form"
        onSubmit={handleSubmit(handleContinue)}
        className="space-y-6"
      >
        {/* Warning Banner */}
        {!isLoadingConfig && !hasApiKey && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to configure your Claude API key before creating prompt
              templates.{" "}
              <Link
                href="/dashboard/integrations"
                className="font-medium underline underline-offset-4 hover:text-foreground"
              >
                Go to Integrations
              </Link>{" "}
              to add your key.
            </AlertDescription>
          </Alert>
        )}

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            System Prompt <span className="text-destructive">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-1.5">
            Use {"{paramName}{/paramName}"} to mark parameter placeholders
          </p>
          <Textarea
            {...register("systemPrompt")}
            className="font-mono text-sm min-h-[200px]"
            placeholder="You are a helpful assistant that..."
            disabled={!hasApiKey}
          />
          {errors.systemPrompt && (
            <p className="text-sm text-destructive mt-1">
              {errors.systemPrompt.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5 text-right">
            {systemPrompt?.length || 0} characters
          </p>
        </div>

        {/* Parameters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-foreground">
              Parameters
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasApiKey}
              onClick={() =>
                append({ name: "", description: "", required: true, default: "" })
              }
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Parameter
            </Button>
          </div>

          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No parameters defined. Add parameters to create customizable
              placeholders in your prompt.
            </p>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-3 border border-border rounded-lg space-y-3"
                >
                  {/* Row 1: Name + Remove */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        {...register(`parameters.${index}.name`)}
                        placeholder="Parameter name"
                      />
                      {errors.parameters?.[index]?.name && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.parameters[index]?.name?.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Row 2: Description */}
                  <Input
                    {...register(`parameters.${index}.description`)}
                    placeholder="Description (shown to callers)"
                  />

                  {/* Row 3: Default value */}
                  <Input
                    {...register(`parameters.${index}.default`)}
                    placeholder="Default value (optional)"
                  />

                  {/* Row 4: Required checkbox */}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      {...register(`parameters.${index}.required`)}
                      className="rounded border-border"
                    />
                    Required parameter
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Max Tokens
          </label>
          <Input
            type="number"
            {...register("maxTokens", { valueAsNumber: true })}
            min={1}
            max={64000}
            step={1}
            className="w-32"
            disabled={!hasApiKey}
          />
          {errors.maxTokens && (
            <p className="text-sm text-destructive mt-1">
              {errors.maxTokens.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1.5">
            Maximum output tokens (1-64,000). Default: 4,096
          </p>
        </div>
      </form>
    </WizardShell>
  );
}
