"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { ExternalLink, RotateCcw, Check, Loader2, Clock } from "lucide-react";
import RunCard from "@/components/RunCard";
import { authenticatedFetch, API_URL } from "@/lib/api";

interface RefundInfo {
  id: string;
  refund_number: number;
  status: string;
  amount: number;
}

interface HistoryRunCardProps {
  id: string;
  jobId?: string;
  jobName?: string;
  status: string;
  createdAt: string;
  totalCost: number | null;
  refund?: RefundInfo | null;
  onRefund?: () => void;
}

export default function HistoryRunCard({
  id,
  jobId,
  jobName,
  status,
  createdAt,
  totalCost,
  refund,
  onRefund,
}: HistoryRunCardProps) {
  const [isRefunding, setIsRefunding] = useState(false);
  const [localRefund, setLocalRefund] = useState<RefundInfo | null>(
    refund || null,
  );
  const [refundError, setRefundError] = useState<string | null>(null);

  const isFailed = status.toLowerCase() === "failed";
  const hasRefund = !!localRefund;
  const isPending = localRefund?.status === "pending";
  const isApproved = localRefund?.status === "approved";
  const isDenied = localRefund?.status === "denied";
  const canRefund = isFailed && !hasRefund && totalCost && totalCost > 0;

  const handleRefund = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion

    if (!canRefund || isRefunding) return;

    setIsRefunding(true);
    setRefundError(null);

    try {
      const response = await authenticatedFetch(`${API_URL}/refunds`, {
        method: "POST",
        body: JSON.stringify({ run_id: id }),
      });

      const result = await response.json();

      if (result.success) {
        setLocalRefund({
          id: result.refund_id,
          refund_number: result.refund_number,
          status: "pending",
          amount: result.amount,
        });
        onRefund?.();
      } else {
        setRefundError(result.error || "Failed to submit refund request");
      }
    } catch (err) {
      setRefundError("Failed to submit refund request. Please try again.");
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <RunCard
      id={id}
      status={status}
      createdAt={createdAt}
      totalCost={totalCost}
      title={jobName || (jobId ? `Job ${jobId.slice(0, 8)}...` : "Unknown Job")}
      headerRight={
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Request refund button for failed jobs without refund */}
          {canRefund && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefund}
              disabled={isRefunding}
              className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-800 dark:hover:bg-amber-950"
            >
              {isRefunding ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3 w-3 mr-1.5" />
                  Request Refund
                </>
              )}
            </Button>
          )}

          {/* Pending refund indicator */}
          {isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 dark:bg-amber-950 rounded">
              <Clock className="h-3 w-3" />
              Refund #{localRefund.refund_number} Pending
            </span>
          )}

          {/* Approved refund indicator */}
          {isApproved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium px-2 py-1 bg-emerald-50 dark:bg-emerald-950 rounded">
              <Check className="h-3 w-3" />
              Refunded ${localRefund.amount.toFixed(2)}
            </span>
          )}

          {/* Denied refund indicator */}
          {isDenied && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium px-2 py-1 bg-red-50 dark:bg-red-950 rounded">
              Refund Denied
            </span>
          )}
        </div>
      }
      footerLeft={
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">
            Run ID: {id.slice(0, 8)}...
          </span>
          {refundError && (
            <span className="text-xs text-destructive">{refundError}</span>
          )}
        </div>
      }
      footerRight={
        jobId ? (
          <Button variant="outline" size="sm" as={Link} href={`/jobs/${jobId}`}>
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Open in Canvas
          </Button>
        ) : null
      }
    />
  );
}
