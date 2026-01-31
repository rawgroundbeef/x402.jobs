"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { hasUnsavedChanges, clearDraft } from "@/lib/wizard-draft";

interface WizardShellProps {
  children: React.ReactNode;
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  onBack?: () => void;
  backHref?: string;
  showBack?: boolean;
  showCancel?: boolean;
  footer?: React.ReactNode;
}

export function WizardShell({
  children,
  step,
  totalSteps,
  title,
  description,
  onBack,
  backHref,
  showBack = step > 1,
  showCancel = true,
  footer,
}: WizardShellProps) {
  const router = useRouter();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowCancelConfirm(true);
    } else {
      router.push("/dashboard/resources");
    }
  };

  const handleDiscard = () => {
    clearDraft();
    router.push("/dashboard/resources");
  };

  return (
    <>
      <div className="py-6 px-6">
        {/* Page header — title left, step counter right */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <span className="text-sm text-muted-foreground">Step {step} of {totalSteps}</span>
        </div>
        <hr className="border-t border-border mb-6" />

        {/* Description */}
        {description && (
          <p className="text-[15px] text-muted-foreground mb-6">{description}</p>
        )}

        {/* Content — left-aligned, max-width constrained */}
        <div className="max-w-[720px]">{children}</div>

        {/* Footer */}
        <div className="max-w-[720px] flex items-center justify-between mt-8 pt-6 border-t border-border">
          {/* Back button */}
          {showBack ? (
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {/* Right side: custom footer + cancel */}
          <div className="flex items-center gap-3">
            {footer}
            {showCancel && (
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-4">
            <h2 className="text-xl font-semibold text-card-foreground mb-2">
              Discard this resource?
            </h2>
            <p className="text-muted-foreground mb-6">Your progress will be lost.</p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Editing
              </Button>
              <Button variant="destructive" onClick={handleDiscard}>
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
