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
      router.push("/resources");
    }
  };

  const handleDiscard = () => {
    clearDraft();
    router.push("/resources");
  };

  return (
    <>
      <div className="min-h-[calc(100vh-64px)] bg-[#0a0f14] py-8">
        <div className="max-w-[800px] mx-auto px-4">
          <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-6 sm:p-8">
            {/* Step indicator */}
            <div className="text-sm text-[#5c6670] mb-6">
              Step {step} of {totalSteps}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold text-white mb-6">{title}</h1>

            {/* Content */}
            <div>{children}</div>

            {/* Navigation footer */}
            <div className="flex justify-between items-center pt-6 border-t border-[#252d3a] mt-8">
              {/* Back button */}
              {showBack && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              )}
              {!showBack && <div />}

              {/* Custom footer or Cancel button */}
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
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#111820] border border-[#252d3a] rounded-xl p-6 max-w-md mx-4">
            <h2 className="text-xl font-semibold text-white mb-2">
              Discard this resource?
            </h2>
            <p className="text-[#5c6670] mb-6">Your progress will be lost.</p>
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
