"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { PollStep, PollProgress, LROResult } from "./types";

interface UseLROPollingOptions {
  maxAttempts?: number;
  defaultRetryAfterSeconds?: number;
}

export interface UseLROPollingReturn {
  // Polling state
  isPolling: boolean;
  pollStatus: string | null;
  pollProgress: PollProgress | null;
  pollSteps: PollStep[];
  pollRawData: unknown;
  showAdvancedLogs: boolean;
  setShowAdvancedLogs: (show: boolean) => void;

  // Result state
  result: LROResult | null;
  error: string | null;

  // Actions
  startPolling: (
    statusUrl: string,
    retryAfterSeconds?: number,
  ) => Promise<void>;
  reset: () => void;
}

export function useLROPolling(
  options: UseLROPollingOptions = {},
): UseLROPollingReturn {
  const { maxAttempts = 120, defaultRetryAfterSeconds = 2 } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [pollStatus, setPollStatus] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState<PollProgress | null>(null);
  const [pollSteps, setPollSteps] = useState<PollStep[]>([]);
  const [pollRawData, setPollRawData] = useState<unknown>(null);
  const [showAdvancedLogs, setShowAdvancedLogs] = useState(false);
  const [result, setResult] = useState<LROResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
    setPollStatus(null);
    setPollProgress(null);
    setPollSteps([]);
    setPollRawData(null);
    setShowAdvancedLogs(false);
    setResult(null);
    setError(null);
  }, []);

  const startPolling = useCallback(
    async (statusUrl: string, retryAfterSeconds?: number) => {
      const interval = retryAfterSeconds || defaultRetryAfterSeconds;

      setIsPolling(true);
      setPollStatus("Running...");
      setPollProgress(null);
      setPollSteps([]);
      setPollRawData(null);
      setResult(null);
      setError(null);

      let attempts = 0;

      const poll = async (): Promise<boolean> => {
        attempts++;
        try {
          const response = await fetch(statusUrl);
          const data = await response.json();
          setPollRawData(data);

          // Handle steps array
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
          } else if (
            data.progress &&
            typeof data.progress.completed === "number" &&
            typeof data.progress.total === "number"
          ) {
            setPollProgress(data.progress);
          }

          // Handle message
          if (data.message && !data.steps) {
            setPollStatus(data.message);
          }

          const jobState = data.state || data.status;

          // Success states
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

            // Extract result - prefer showing full data if it has useful fields like artifactUrl
            const hasArtifact = data.artifactUrl || data.imageUrl || data.url;
            const resultData = hasArtifact
              ? data
              : data.result || data.response || data.output || data;
            const responseText =
              typeof resultData === "object"
                ? JSON.stringify(resultData, null, 2)
                : String(resultData);
            setResult({ response: responseText, fullData: data });
            return false;
          }

          // Failure states
          if (jobState === "failed" || jobState === "error") {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsPolling(false);
            setError(data.error || data.message || "Execution failed");
            return false;
          }

          // Timeout
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

      // Initial delay before first poll
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      let shouldContinue = await poll();

      if (shouldContinue) {
        pollIntervalRef.current = setInterval(async () => {
          const cont = await poll();
          if (!cont && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }, interval * 1000);
      }
    },
    [maxAttempts, defaultRetryAfterSeconds],
  );

  return {
    isPolling,
    pollStatus,
    pollProgress,
    pollSteps,
    pollRawData,
    showAdvancedLogs,
    setShowAdvancedLogs,
    result,
    error,
    startPolling,
    reset,
  };
}
