"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { X, Plus, Loader2, Search, Zap, Trash2 } from "lucide-react";
import { authenticatedFetcher, authenticatedFetch } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { useModals } from "@/contexts/ModalContext";

interface Job {
  id: string;
  name: string;
  description?: string;
  network: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface JobsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentJobId?: string | null;
  onSelect?: (job: Job) => void;
  onDelete?: (jobId: string) => void;
}

export function JobsSidebar({
  isOpen,
  onClose,
  currentJobId,
  onSelect,
  onDelete,
}: JobsSidebarProps) {
  const router = useRouter();
  const { openCreateJob } = useModals();
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: jobsData,
    error,
    isLoading,
    mutate,
  } = useSWR<{ jobs: Job[] }>(isOpen ? "/jobs" : null, authenticatedFetcher);

  const jobs = jobsData?.jobs || [];
  const filteredJobs = search
    ? jobs.filter(
        (j) =>
          j.name.toLowerCase().includes(search.toLowerCase()) ||
          j.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : jobs;

  const handleSelect = (job: Job) => {
    if (onSelect) {
      onSelect(job);
    } else {
      router.push(`/jobs/${job.id}`);
    }
    onClose();
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
      if (onDelete) onDelete(jobId);
    } catch (err) {
      console.error("Delete error:", err);
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNew = () => {
    openCreateJob();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-80 bg-card border-l border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-[53px] flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-foreground">My Jobs</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNew}
              title="New Job"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">
              Failed to load jobs
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {search ? "No matching jobs" : "No jobs yet"}
              </p>
              {!search && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNew}
                  className="mt-3"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Job
                </Button>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredJobs.map((job) => {
                const isCurrent = job.id === currentJobId;
                return (
                  <button
                    key={job.id}
                    onClick={() => handleSelect(job)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                      isCurrent
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <ChainIcon
                      network={job.network as "solana" | "base"}
                      className="h-4 w-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{job.name}</p>
                      {job.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, job.id)}
                      disabled={deletingId === job.id}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      title="Delete job"
                    >
                      {deletingId === job.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleNew}
          >
            <Plus className="h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>
    </>
  );
}
