"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { getSuccessRateColor } from "@/lib/format";

interface RiskyJobConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  jobName: string;
  successRate: number;
  price: string;
  isLoading?: boolean;
}

export function RiskyJobConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  jobName,
  successRate,
  price,
  isLoading,
}: RiskyJobConfirmModalProps) {
  const rateColor = getSuccessRateColor(successRate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Run {jobName}?</DialogTitle>
          <DialogDescription>
            Cost: <span className="font-semibold text-foreground">{price}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground space-y-2 py-2">
          <p>
            This job has a{" "}
            <span className={`font-medium ${rateColor}`}>{successRate}%</span>{" "}
            success rate.
          </p>
          <p>If it fails, unused resources are refunded.</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Running..." : `Run — ${price}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
