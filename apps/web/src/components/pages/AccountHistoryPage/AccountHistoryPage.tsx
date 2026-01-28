"use client";

import { useState } from "react";
import useSWR from "swr";
import { authenticatedFetcher } from "@/lib/api";
import { Spinner } from "@x402jobs/ui/spinner";
import { Button } from "@x402jobs/ui/button";
import {
  Briefcase,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  List,
} from "lucide-react";
import HistoryRunCard from "./components/HistoryRunCard";
import TimelineView from "./components/TimelineView";

interface RefundInfo {
  id: string;
  refund_number: number;
  status: string;
  amount: number;
}

interface Run {
  id: string;
  status: string;
  created_at: string;
  total_cost: number | null;
  refund?: RefundInfo | null;
  job: {
    id: string;
    name: string;
  } | null;
}

interface RunsResponse {
  runs: Run[];
  total: number;
  limit: number;
  offset: number;
}

type ViewMode = "jobs" | "resources";
type StatusFilter = "all" | "completed" | "failed";

const PAGE_SIZE = 20;

export default function AccountHistoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("jobs");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);

  const offset = page * PAGE_SIZE;
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const { data, isLoading, mutate } = useSWR<RunsResponse>(
    `/runs?limit=${PAGE_SIZE}&offset=${offset}${statusParam}`,
    authenticatedFetcher,
  );

  const runs = data?.runs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;

  const handleStatusFilterChange = (newFilter: StatusFilter) => {
    setStatusFilter(newFilter);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "jobs"
              ? "Job runs and payments."
              : "Individual resource calls."}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === "jobs" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setViewMode("jobs");
              setPage(0);
            }}
            className="gap-1.5"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Jobs
          </Button>
          <Button
            variant={viewMode === "resources" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setViewMode("resources");
              setPage(0);
            }}
            className="gap-1.5"
          >
            <Cpu className="h-3.5 w-3.5" />
            Resources
          </Button>
        </div>
      </header>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <div className="flex items-center gap-1">
          <Button
            variant={statusFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilterChange("all")}
            className="gap-1"
          >
            <List className="h-3.5 w-3.5" />
            All
          </Button>
          <Button
            variant={statusFilter === "completed" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilterChange("completed")}
            className="gap-1"
          >
            <Check className="h-3.5 w-3.5" />
            Success
          </Button>
          <Button
            variant={statusFilter === "failed" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleStatusFilterChange("failed")}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Failed
          </Button>
        </div>
      </div>

      {viewMode === "resources" ? (
        <TimelineView statusFilter={statusFilter} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {statusFilter !== "all"
            ? `No ${statusFilter} jobs found.`
            : "No jobs yet. Run a job to see your history here."}
        </p>
      ) : (
        <>
          <div className="space-y-3">
            {runs.map((run) => (
              <HistoryRunCard
                key={run.id}
                id={run.id}
                jobId={run.job?.id}
                jobName={run.job?.name}
                status={run.status}
                createdAt={run.created_at}
                totalCost={run.total_cost}
                refund={run.refund}
                onRefund={() => mutate()}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} of{" "}
                {total} jobs
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!hasPrevPage}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
