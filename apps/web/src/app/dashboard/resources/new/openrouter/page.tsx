"use client";

import { useEffect, useState } from "react";
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
import { openRouterParameterSchema } from "@/types/openrouter-resource";
import { ModelBrowser } from "@/components/ModelBrowser";
import { ProviderIcon } from "@/components/icons/ProviderIcons";
import { useAIModelsQuery, type AIModel } from "@/hooks/useAIModelsQuery";

interface OpenRouterIntegrationConfig {
  hasApiKey: boolean;
  isEnabled: boolean;
}

const openrouterSchema = z.object({
  systemPrompt: z.string().min(1, "System prompt is required"),
  parameters: z.array(openRouterParameterSchema).default([]),
  temperature: z.number().min(0).max(2).default(1.0),
  maxTokens: z.number().int().min(1).max(128000).default(4096),
});

type OpenRouterFormData = z.infer<typeof openrouterSchema>;

export default function OpenRouterConfigPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);

  const { data: integrationData, isLoading: isLoadingConfig } =
    useSWR<OpenRouterIntegrationConfig>(
      "/integrations/openrouter/config",
      authenticatedFetcher,
      {
        revalidateOnFocus: false,
      },
    );

  const hasApiKey = integrationData?.hasApiKey ?? false;
  const { models } = useAIModelsQuery();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<OpenRouterFormData>({
    resolver: zodResolver(openrouterSchema),
    mode: "onChange",
    defaultValues: {
      systemPrompt: "",
      parameters: [],
      temperature: 1.0,
      maxTokens: 4096,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "parameters",
  });

  const systemPrompt = watch("systemPrompt");

  // Deep link protection
  useEffect(() => {
    const draft = getDraft();
    if (!draft?.type) {
      router.replace("/dashboard/resources/new");
      return;
    }
    if (draft.type !== "openrouter") {
      router.replace("/dashboard/resources/new");
      return;
    }
    setIsLoaded(true);
  }, [router]);

  // Draft restoration - form values
  useEffect(() => {
    const draft = getDraft();
    if (draft?.openrouterConfig) {
      const config = draft.openrouterConfig as {
        systemPrompt?: string;
        parameters?: Array<{
          name: string;
          description?: string;
          required?: boolean;
          default?: string;
        }>;
        temperature?: number;
        maxTokens?: number;
      };
      reset({
        systemPrompt: config.systemPrompt || "",
        parameters: config.parameters || [],
        temperature: config.temperature ?? 1.0,
        maxTokens: config.maxTokens ?? 4096,
      });
    }
  }, [reset]);

  // Draft restoration - model selection
  useEffect(() => {
    const draft = getDraft();
    if (draft?.openrouterConfig && models.length > 0) {
      const config = draft.openrouterConfig as {
        modelId?: string;
      };
      if (config.modelId) {
        const model = models.find((m) => m.id === config.modelId);
        if (model) {
          setSelectedModel(model);
        }
      }
    }
  }, [models]);

  if (!isLoaded) return null;

  const handleContinue = (data: OpenRouterFormData) => {
    if (!selectedModel) return;

    saveDraft({
      openrouterConfig: {
        modelId: selectedModel.id,
        modelName: selectedModel.display_name,
        provider: selectedModel.provider,
        systemPrompt: data.systemPrompt,
        parameters: data.parameters,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
      },
    });

    router.push("/dashboard/resources/new/details");
  };

  const canContinue = hasApiKey && selectedModel !== null && isValid;

  return (
    <WizardShell
      step={2}
      totalSteps={4}
      title="Configure OpenRouter Resource"
      description="Select a model and configure your AI prompt"
      backHref="/dashboard/resources/new"
      footer={
        <Button
          type="submit"
          form="openrouter-form"
          disabled={!canContinue}
        >
          Continue
        </Button>
      }
    >
      <form
        id="openrouter-form"
        onSubmit={handleSubmit(handleContinue)}
        className="space-y-6"
      >
        {!isLoadingConfig && !hasApiKey && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to configure your OpenRouter API key before creating
              resources.{" "}
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

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Select Model <span className="text-destructive">*</span>
          </label>
          {!selectedModel ? (
            <ModelBrowser
              onSelect={(model) => setSelectedModel(model)}
              selectedModelId={undefined}
            />
          ) : (
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProviderIcon
                    provider={selectedModel.provider}
                    className="w-5 h-5"
                  />
                  <span className="font-medium">
                    {selectedModel.display_name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setSelectedModel(null)}
                >
                  Change
                </Button>
              </div>
              {selectedModel.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {selectedModel.description}
                </p>
              )}
            </div>
          )}
        </div>

        {selectedModel && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                System Prompt <span className="text-destructive">*</span>
              </label>
              <p className="text-sm text-muted-foreground">
                Define parameters using{" "}
                <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
                  {"{paramName}{/paramName}"}
                </code>{" "}
                syntax
              </p>
              <Textarea
                {...register("systemPrompt")}
                placeholder="You are a helpful assistant that..."
                className="min-h-[200px] font-mono text-sm"
                disabled={!hasApiKey}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {systemPrompt?.length || 0} characters
                </span>
              </div>
              {errors.systemPrompt && (
                <p className="text-sm text-destructive">
                  {errors.systemPrompt.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Parameters
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      name: "",
                      description: "",
                      required: true,
                      default: "",
                    })
                  }
                  disabled={!hasApiKey}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Parameter
                </Button>
              </div>
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  No parameters defined. Add parameters that users will provide
                  when calling your resource.
                </p>
              )}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 border border-border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Parameter Name
                        </label>
                        <Input
                          {...register(`parameters.${index}.name`)}
                          placeholder="parameterName"
                          className="mt-1"
                          disabled={!hasApiKey}
                        />
                        {errors.parameters?.[index]?.name && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.parameters[index]?.name?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Description
                        </label>
                        <Input
                          {...register(`parameters.${index}.description`)}
                          placeholder="Describe this parameter..."
                          className="mt-1"
                          disabled={!hasApiKey}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Default Value
                        </label>
                        <Input
                          {...register(`parameters.${index}.default`)}
                          placeholder="Optional default value"
                          className="mt-1"
                          disabled={!hasApiKey}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          {...register(`parameters.${index}.required`)}
                          id={`param-${field.id}-required`}
                          className="rounded border-input"
                          disabled={!hasApiKey}
                        />
                        <label
                          htmlFor={`param-${field.id}-required`}
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          Required parameter
                        </label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={!hasApiKey}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">
                Model Configuration
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Temperature
                  </label>
                  <Input
                    type="number"
                    {...register("temperature", { valueAsNumber: true })}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                    disabled={!hasApiKey}
                  />
                  {errors.temperature && (
                    <p className="text-sm text-destructive">
                      {errors.temperature.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Randomness (0-2). Lower = more focused. Default: 1.0
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Max Tokens
                  </label>
                  <Input
                    type="number"
                    {...register("maxTokens", { valueAsNumber: true })}
                    min={1}
                    max={128000}
                    step={1}
                    className="w-full"
                    disabled={!hasApiKey}
                  />
                  {errors.maxTokens && (
                    <p className="text-sm text-destructive">
                      {errors.maxTokens.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Maximum output tokens (1-128,000). Default: 4,096
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </form>
    </WizardShell>
  );
}
