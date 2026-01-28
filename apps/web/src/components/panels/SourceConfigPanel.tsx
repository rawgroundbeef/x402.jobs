"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { Database, Globe, Plus, Trash2, Search, Loader2 } from "lucide-react";
import { SlidePanel } from "./SlidePanel";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
import { useToast } from "@x402jobs/ui/toast";
import { publicFetcher } from "@/lib/api";
import type {
  SourceType,
  SourceConfig,
} from "@/components/workflow/nodes/SourceNode";

export interface SourceConfigPanelConfig {
  sourceType: SourceType;
  config: SourceConfig;
}

interface PublicJob {
  id: string;
  name: string;
  slug?: string;
  owner_username?: string;
  avatar_url?: string;
}

interface SourceConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SourceConfigPanelConfig) => void;
  sourceType: SourceType;
  currentConfig?: SourceConfig;
  currentJobId?: string; // The current job's ID for "self" option
  /** Stack level for z-index ordering */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
}

const SINCE_OPTIONS = [
  { value: "1h", label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export function SourceConfigPanel({
  isOpen,
  onClose,
  onSave,
  sourceType,
  currentConfig,
  currentJobId,
  stackLevel = 1,
  hasStackedChild = false,
}: SourceConfigPanelProps) {
  const { toast } = useToast();

  // Job History state
  const [jobId, setJobId] = useState(currentConfig?.jobId || "");
  const [jobName, setJobName] = useState(currentConfig?.jobName || "");
  const [limit, setLimit] = useState(currentConfig?.limit || 100);
  const [since, setSince] = useState(currentConfig?.since || "24h");
  const [jobSearch, setJobSearch] = useState("");
  const [debouncedJobSearch, setDebouncedJobSearch] = useState("");

  // URL Fetch state
  const [url, setUrl] = useState(currentConfig?.url || "");
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    currentConfig?.headers
      ? Object.entries(currentConfig.headers).map(([key, value]) => ({
          key,
          value,
        }))
      : [],
  );

  const wasOpenRef = useRef(false);

  // Debounce job search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedJobSearch(jobSearch);
    }, 300);
    return () => clearTimeout(timeout);
  }, [jobSearch]);

  // Fetch public jobs for job history picker
  const jobsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (debouncedJobSearch) {
      params.set("search", debouncedJobSearch);
    }
    return params.toString();
  }, [debouncedJobSearch]);

  const { data: jobsData, isLoading: jobsLoading } = useSWR<{
    jobs: PublicJob[];
  }>(
    isOpen && sourceType === "job_history"
      ? `/jobs/public?${jobsQueryString}`
      : null,
    publicFetcher,
  );

  const publicJobs = jobsData?.jobs || [];

  // Reset form when panel opens with new config
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      // Job History
      setJobId(currentConfig?.jobId || "");
      setJobName(currentConfig?.jobName || "");
      setLimit(currentConfig?.limit || 100);
      setSince(currentConfig?.since || "24h");
      setJobSearch("");
      setDebouncedJobSearch("");

      // URL Fetch
      setUrl(currentConfig?.url || "");
      setHeaders(
        currentConfig?.headers
          ? Object.entries(currentConfig.headers).map(([key, value]) => ({
              key,
              value,
            }))
          : [],
      );
    }
  }, [isOpen, currentConfig]);

  const handleSave = () => {
    const config: SourceConfig = {};

    if (sourceType === "job_history") {
      config.jobId = jobId;
      config.jobName = jobName;
      config.limit = limit;
      config.since = since;
    } else if (sourceType === "url_fetch") {
      config.url = url;
      if (headers.length > 0) {
        config.headers = {};
        headers.forEach((h) => {
          if (h.key.trim()) {
            config.headers![h.key.trim()] = h.value;
          }
        });
      }
    }

    onSave({
      sourceType,
      config,
    });
    toast({
      title: "Source configuration saved",
      variant: "success",
    });
  };

  const handleSelectJob = (job: PublicJob | "self") => {
    if (job === "self") {
      setJobId("self");
      setJobName("This Job (self)");
    } else {
      setJobId(job.id);
      const displayName = job.owner_username
        ? `@${job.owner_username}/${job.slug || job.name}`
        : job.name;
      setJobName(displayName);
    }
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setHeaders(
      headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)),
    );
  };

  const isValid =
    (sourceType === "job_history" && jobId.trim().length > 0) ||
    (sourceType === "url_fetch" && url.trim().length > 0);

  const sourceTypeLabels: Record<SourceType, string> = {
    job_history: "Job History",
    url_fetch: "URL Fetch",
  };

  const sourceTypeIcons: Record<
    SourceType,
    React.ComponentType<{ className?: string }>
  > = {
    job_history: Database,
    url_fetch: Globe,
  };

  const Icon = sourceTypeIcons[sourceType];

  const headerAvatar = (
    <DrawerHeaderAvatar
      fallbackIcon={<Icon className="h-8 w-8 text-source" />}
      fallbackClassName="bg-source/20"
    />
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-start gap-4 py-1 pr-6">
          {headerAvatar}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-lg">
                Configure Source
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-500">
                FREE
              </span>
            </div>
            <p className="text-sm text-muted-foreground/80 mt-1 font-normal">
              {sourceTypeLabels[sourceType]}
            </p>
          </div>
        </div>
      }
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="bg-source hover:bg-source/90 text-white"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Job History Config */}
        {sourceType === "job_history" && (
          <>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                Select Job
              </label>

              {/* Selected job display */}
              {jobId && (
                <div className="mb-3 p-3 bg-source/10 border border-source/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-source" />
                    <span className="text-sm font-medium">
                      {jobName || jobId}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setJobId("");
                      setJobName("");
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}

              {/* Job search */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={jobSearch}
                  onChange={(e) => setJobSearch(e.target.value)}
                  placeholder="Search jobs..."
                  className="pl-9"
                />
              </div>

              {/* Job list */}
              <div className="border border-border rounded-lg max-h-[200px] overflow-y-auto">
                {/* Self option (current job) */}
                {currentJobId && (
                  <button
                    onClick={() => handleSelectJob("self")}
                    className={`w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border ${
                      jobId === "self" ? "bg-source/10" : ""
                    }`}
                  >
                    <p className="text-sm font-medium">This Job (self)</p>
                    <p className="text-xs text-muted-foreground">
                      Reference this job&apos;s own history
                    </p>
                  </button>
                )}

                {jobsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : publicJobs.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    {debouncedJobSearch
                      ? "No jobs found"
                      : "No public jobs available"}
                  </div>
                ) : (
                  publicJobs.map((job) => {
                    const displayName = job.owner_username
                      ? `@${job.owner_username}/${job.slug || job.name}`
                      : job.name;
                    return (
                      <button
                        key={job.id}
                        onClick={() => handleSelectJob(job)}
                        className={`w-full px-3 py-2 text-left hover:bg-accent transition-colors border-b border-border last:border-b-0 ${
                          jobId === job.id ? "bg-source/10" : ""
                        }`}
                      >
                        <p className="text-sm font-medium font-mono truncate">
                          {displayName}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">
                  Limit (max results)
                </label>
                <Input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                  min={1}
                  max={1000}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">
                  Time Range
                </label>
                <Select
                  value={since}
                  onChange={setSince}
                  options={SINCE_OPTIONS}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Fetches successful run outputs from the selected job.
              <br />
              Results are sorted by most recent first.
            </p>
          </>
        )}

        {/* URL Fetch Config */}
        {sourceType === "url_fetch" && (
          <>
            <div>
              <label className="block text-xs text-muted-foreground mb-2">
                URL
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/data"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supports template variables:{" "}
                <code className="bg-muted px-1 rounded">
                  {"{{trigger.field}}"}
                </code>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-muted-foreground">
                  Headers (optional)
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={addHeader}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Header
                </Button>
              </div>

              {headers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
                  <p>No headers configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={header.key}
                        onChange={(e) =>
                          updateHeader(index, "key", e.target.value)
                        }
                        placeholder="Header name"
                        className="flex-1 font-mono text-sm"
                      />
                      <Input
                        value={header.value}
                        onChange={(e) =>
                          updateHeader(index, "value", e.target.value)
                        }
                        placeholder="Value"
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeHeader(index)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Performs a GET request to the URL and returns the response.
              <br />
              JSON responses are automatically parsed.
            </p>
          </>
        )}
      </div>
    </SlidePanel>
  );
}
