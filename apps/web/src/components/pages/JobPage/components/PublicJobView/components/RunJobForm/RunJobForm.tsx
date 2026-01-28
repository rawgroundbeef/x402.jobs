"use client";

import { useState } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Textarea } from "@x402jobs/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@x402jobs/ui/alert";
import { ImageUrlOrUpload } from "@/components/inputs";
import { RiskyJobConfirmModal } from "@/components/modals/RiskyJobConfirmModal";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, XCircle } from "lucide-react";
import {
  PollingProgress,
  ResultDisplay,
  type PollStep,
  type LROResult,
  type LROPayment,
} from "@/components/lro";

interface InputField {
  type?: string;
  required?: boolean;
  description?: string;
}

interface RunJobFormProps {
  webhookUrl: string;
  priceDisplay: string;
  finalPrice: number;
  /** Success rate (0-100) for warning display */
  successRate?: number | null;
  /** Job name for confirmation modal */
  jobName?: string;
  // Form state
  formData: Record<string, string>;
  fieldErrors: Record<string, string>;
  fieldEntries: [string, InputField][];
  hasInputs: boolean;
  onFieldChange: (key: string, value: string) => void;
  // Execution state
  isLoading: boolean;
  onSubmit: () => void;
  /** Validate form before submission - returns true if valid */
  onValidate?: () => boolean;
  // Polling state
  isPolling: boolean;
  pollStatus: string | null;
  pollProgress: { completed: number; total: number } | null;
  pollRawData: unknown;
  pollSteps: PollStep[];
  showAdvancedLogs: boolean;
  onAdvancedLogsToggle: (open: boolean) => void;
  // Result state
  result: LROResult | null;
  error: string | null;
  payment: LROPayment | null;
  showFullResult: boolean;
  onShowFullResultToggle: () => void;
  outputCopied: boolean;
  onCopyOutput: (text: string) => void;
}

export default function RunJobForm({
  priceDisplay,
  finalPrice,
  successRate,
  jobName = "this job",
  formData,
  fieldErrors,
  fieldEntries,
  hasInputs,
  onFieldChange,
  isLoading,
  onSubmit,
  onValidate,
  isPolling,
  pollStatus,
  pollProgress,
  pollRawData,
  pollSteps,
  showAdvancedLogs,
  onAdvancedLogsToggle,
  result,
  error,
  payment,
  showFullResult,
  onShowFullResultToggle,
  outputCopied,
  onCopyOutput,
}: RunJobFormProps) {
  const { user } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Determine if job is risky (success rate < 90%)
  const isRiskyJob = successRate != null && successRate < 90;

  const handleRunClick = () => {
    // Validate form first (if validator provided)
    if (onValidate && !onValidate()) {
      return; // Don't show modal or submit if validation fails
    }

    if (isRiskyJob) {
      setShowConfirmModal(true);
    } else {
      onSubmit();
    }
  };

  const handleConfirmRun = () => {
    setShowConfirmModal(false);
    onSubmit();
  };

  return (
    <>
      {/* Confirmation Modal for Risky Jobs */}
      <RiskyJobConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmRun}
        jobName={jobName}
        successRate={successRate || 0}
        price={priceDisplay}
        isLoading={isLoading}
      />
      <div className="mb-10">
        {/* Form Fields */}
        {hasInputs ? (
          <div className="space-y-4 mb-6">
            {fieldEntries.map(([key, field]) => (
              <div key={key}>
                <Label htmlFor={key} className="mb-1.5 block">
                  {key}
                  {field.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>
                {field.description && (
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {field.description}
                  </p>
                )}
                {field.type === "file" ? (
                  <ImageUrlOrUpload
                    value={formData[key] || ""}
                    onChange={(value) => onFieldChange(key, value)}
                    placeholder="Upload image or paste URL..."
                    hasError={!!fieldErrors[key]}
                    disabled={isLoading}
                  />
                ) : field.type === "array" || field.type === "object" ? (
                  <Textarea
                    id={key}
                    value={formData[key] || ""}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                    placeholder={
                      field.type === "array"
                        ? "One item per line..."
                        : "Enter JSON..."
                    }
                    className={fieldErrors[key] ? "border-destructive" : ""}
                    disabled={isLoading}
                    rows={3}
                  />
                ) : (
                  <Input
                    id={key}
                    type={field.type === "number" ? "number" : "text"}
                    value={formData[key] || ""}
                    onChange={(e) => onFieldChange(key, e.target.value)}
                    placeholder={`Enter ${key}...`}
                    className={fieldErrors[key] ? "border-destructive" : ""}
                    disabled={isLoading}
                  />
                )}
                {fieldErrors[key] && (
                  <p className="text-xs text-destructive mt-1">
                    {fieldErrors[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">
            This job has no input parameters.
          </p>
        )}

        {/* Run Button */}
        <div className="flex items-center justify-end gap-3 mb-6">
          {finalPrice > 0 && (
            <span className="text-sm text-muted-foreground">
              Cost:{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {priceDisplay}
              </span>
            </span>
          )}
          <Button
            onClick={handleRunClick}
            disabled={isLoading || !user}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Running...
              </>
            ) : !user ? (
              "Login to Run"
            ) : (
              "Run Job"
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <XCircle className="h-4 w-4" />
            <AlertTitle>
              {pollSteps.some((s) => s.status === "failed")
                ? `Failed at Step ${pollSteps.findIndex((s) => s.status === "failed") + 1}`
                : "Job Failed"}
            </AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Polling Progress */}
        {isPolling && (
          <PollingProgress
            pollStatus={pollStatus}
            pollProgress={pollProgress}
            pollSteps={pollSteps}
            pollRawData={pollRawData}
            showAdvancedLogs={showAdvancedLogs}
            onAdvancedLogsToggle={onAdvancedLogsToggle}
          />
        )}

        {/* Result Display */}
        {result && (
          <ResultDisplay
            result={result}
            payment={payment}
            showFullResult={showFullResult}
            onShowFullResultToggle={onShowFullResultToggle}
            outputCopied={outputCopied}
            onCopyOutput={onCopyOutput}
          />
        )}
      </div>
    </>
  );
}
