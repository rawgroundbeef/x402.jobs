import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import type { PollStep, JobResult, JobPayment } from "../types";

interface InputField {
  type?: string;
  required?: boolean;
  description?: string;
}

interface UseJobExecutionProps {
  jobId: string;
  webhookUrl?: string;
  inputFields: Record<string, InputField>;
}

export function useJobExecution({
  jobId,
  webhookUrl,
  inputFields,
}: UseJobExecutionProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [pollRawData, setPollRawData] = useState<unknown>(null);
  const [pollSteps, setPollSteps] = useState<PollStep[]>([]);
  const [showAdvancedLogs, setShowAdvancedLogs] = useState(false);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<JobPayment | null>(null);
  const [showFullResult, setShowFullResult] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sort fields: required first
  const fieldEntries = useMemo(() => {
    return Object.entries(inputFields).sort(([, a], [, b]) => {
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      return 0;
    });
  }, [inputFields]);

  const hasInputs = fieldEntries.length > 0;

  // Initialize form when job changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const [key] of Object.entries(inputFields)) {
      initial[key] = "";
    }
    setFormData(initial);
  }, [jobId, inputFields]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleFieldChange = useCallback((key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    for (const [key, field] of Object.entries(inputFields)) {
      if (field.required && !formData[key]?.trim()) {
        errors[key] = "This field is required";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [inputFields, formData]);

  const pollForResult = useCallback(
    async (statusUrl: string, retryAfterSeconds = 2) => {
      setIsPolling(true);
      setPollStatus("Running job...");
      let attempts = 0;
      const maxAttempts = 120;

      const poll = async (): Promise<boolean> => {
        attempts++;
        try {
          const response = await fetch(statusUrl);
          const data = await response.json();
          setPollRawData(data);

          if (data.steps && Array.isArray(data.steps)) {
            const completed = data.steps.filter(
              (s: { status: string }) => s.status === "completed",
            ).length;
            setPollProgress({ completed, total: data.steps.length });
            setPollSteps(
              data.steps.map(
                (s: { name?: string; status: string; error?: string }) => ({
                  name: s.name || "Step",
                  status: s.status as PollStep["status"],
                  error: s.error,
                }),
              ),
            );

            const runningStep = data.steps.find(
              (s: { status: string }) => s.status === "running",
            );
            if (runningStep?.name) {
              setPollStatus(`Running: ${runningStep.name}`);
            } else if (data.steps.length > 0) {
              const allDone = data.steps.every(
                (s: { status: string }) => s.status === "completed",
              );
              setPollStatus(allDone ? "Completing..." : "Starting...");
            }
          } else if (data.progress) {
            setPollProgress(data.progress);
          }

          if (data.message && !data.steps) {
            setPollStatus(data.message);
          }

          const jobState = data.state || data.status;

          if (
            jobState === "completed" ||
            jobState === "success" ||
            jobState === "succeeded"
          ) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsPolling(false);
            setPollStatus(null);
            // Extract result - prefer full data if it has artifact fields
            // First check top level, then check nested result/response/output
            const hasTopLevelArtifact =
              data.artifactUrl || data.imageUrl || data.url;
            const nestedResult = data.result || data.response || data.output;
            const hasNestedArtifact =
              nestedResult &&
              typeof nestedResult === "object" &&
              (nestedResult.artifactUrl ||
                nestedResult.imageUrl ||
                nestedResult.url);

            // Use whichever has the artifact, or fall back to data
            const resultData = hasTopLevelArtifact
              ? data
              : hasNestedArtifact
                ? nestedResult
                : data;
            const responseText =
              typeof resultData === "object"
                ? JSON.stringify(resultData, null, 2)
                : String(resultData);
            // fullData should contain the result object that has the artifact URL
            setResult({ response: responseText, fullData: resultData });
            return false;
          }

          if (jobState === "failed" || jobState === "error") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsPolling(false);
            setError(data.error || data.message || "Execution failed");
            return false;
          }

          if (attempts >= maxAttempts) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsPolling(false);
            setError("Request timed out");
            return false;
          }

          return true;
        } catch {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsPolling(false);
          setError("Failed to check status");
          return false;
        }
      };

      await new Promise((resolve) =>
        setTimeout(resolve, retryAfterSeconds * 1000),
      );
      let shouldContinue = await poll();

      if (shouldContinue) {
        pollIntervalRef.current = setInterval(async () => {
          const cont = await poll();
          if (!cont && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, retryAfterSeconds * 1000);
      }
    },
    [],
  );

  const handleSubmit = async () => {
    if (!webhookUrl || !validateForm()) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);
    setPayment(null);
    setPollProgress(null);
    setPollSteps([]);
    setPollRawData(null);
    setShowAdvancedLogs(false);

    try {
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
          resourceUrl: webhookUrl,
          method: "POST",
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

      // Accept both jobId (documented) and runId (legacy) as identifiers
      const asyncJobId = resourceResponse.jobId || resourceResponse.runId;
      if (resourceResponse.statusUrl && asyncJobId) {
        setIsSubmitting(false);
        await pollForResult(
          resourceResponse.statusUrl,
          resourceResponse.retryAfterSeconds || 2,
        );
        return;
      }

      if (asyncJobId && resourceResponse.status === "pending") {
        setIsSubmitting(false);
        await pollForResult(
          `/execute/status/${encodeURIComponent(webhookUrl)}/${asyncJobId}`,
          2,
        );
        return;
      }

      // Extract result - prefer data with artifact fields
      const hasTopLevelArtifact =
        resourceResponse.artifactUrl ||
        resourceResponse.imageUrl ||
        resourceResponse.url;
      const nestedResult =
        resourceResponse.result ||
        resourceResponse.response ||
        resourceResponse.output;
      const hasNestedArtifact =
        nestedResult &&
        typeof nestedResult === "object" &&
        (nestedResult.artifactUrl || nestedResult.imageUrl || nestedResult.url);

      const resultData = hasTopLevelArtifact
        ? resourceResponse
        : hasNestedArtifact
          ? nestedResult
          : resourceResponse;
      const responseText =
        typeof resultData === "object"
          ? JSON.stringify(resultData, null, 2)
          : String(resultData);
      setResult({ response: responseText, fullData: resultData });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyOutput = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setOutputCopied(true);
    setTimeout(() => setOutputCopied(false), 2000);
  };

  const isLoading = isSubmitting || isPolling;

  return {
    // Form state
    formData,
    fieldErrors,
    fieldEntries,
    hasInputs,
    handleFieldChange,
    validateForm,

    // Execution state
    isSubmitting,
    isPolling,
    isLoading,
    handleSubmit,

    // Polling state
    pollStatus,
    pollProgress,
    pollRawData,
    pollSteps,
    showAdvancedLogs,
    setShowAdvancedLogs,

    // Result state
    result,
    error,
    payment,
    showFullResult,
    setShowFullResult,
    outputCopied,
    handleCopyOutput,
  };
}
