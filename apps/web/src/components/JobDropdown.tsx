"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ChevronDown,
  Plus,
  Check,
  Loader2,
  Zap,
  Trash2,
  Settings,
} from "lucide-react";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { cn } from "@x402jobs/ui/utils";

interface Job {
  id: string;
  name: string;
  description?: string;
  network: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface JobDropdownProps {
  currentJobId?: string | null;
  currentJobName?: string;
  currentNetwork?: "solana" | "base";
  onSelectJob?: (job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  onOpenSettings?: () => void;
  onNewJob?: () => void;
  className?: string;
}

export function JobDropdown({
  currentJobId,
  currentJobName,
  currentNetwork = "solana",
  onSelectJob,
  onDeleteJob,
  onOpenSettings,
  onNewJob,
  className,
}: JobDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    data: jobsData,
    isLoading,
    mutate,
  } = useSWR<{ jobs: Job[] }>(isOpen ? "/jobs" : null, authenticatedFetcher);

  const jobs = jobsData?.jobs || [];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectJob = (job: Job) => {
    if (onSelectJob) {
      onSelectJob(job);
    } else {
      router.push(`/jobs/${job.id}`);
    }
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job?")) return;

    setDeletingId(jobId);
    try {
      const res = await authenticatedFetch(`/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      mutate();
      if (onDeleteJob) onDeleteJob(jobId);
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNewJob = () => {
    if (onNewJob) {
      onNewJob();
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-0 pr-2 py-1.5 text-sm"
      >
        {currentJobId ? (
          <>
            <ChainIcon
              network={currentNetwork}
              className="w-4 h-4 flex-shrink-0"
            />
            <span className="font-medium truncate max-w-[200px]">
              {currentJobName || "Untitled Job"}
            </span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Select Job</span>
          </>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background/80 backdrop-blur-sm border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              My Jobs
            </p>
          </div>

          {/* Jobs List */}
          <div className="max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No jobs yet</p>
              </div>
            ) : (
              <div className="py-1">
                {jobs.map((job) => {
                  const isCurrent = job.id === currentJobId;
                  return (
                    <button
                      key={job.id}
                      onClick={() => handleSelectJob(job)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group",
                        isCurrent ? "bg-primary/10" : "hover:bg-accent",
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isCurrent && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        )}
                        <ChainIcon
                          network={job.network as "solana" | "base"}
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            !isCurrent && "ml-6",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm truncate",
                            isCurrent && "font-medium text-primary",
                          )}
                        >
                          {job.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, job.id)}
                        disabled={deletingId === job.id}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        title="Delete job"
                      >
                        {deletingId === job.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-border p-2 space-y-1">
            <button
              onClick={handleNewJob}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Job
            </button>
            {currentJobId && onOpenSettings && (
              <button
                onClick={() => {
                  onOpenSettings();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <Settings className="h-4 w-4" />
                Job Settings
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
