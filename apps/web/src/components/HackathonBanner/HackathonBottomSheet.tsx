"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, X, Trophy, Clock, CheckCircle2 } from "lucide-react";
import { type ActiveHackathon } from "@/hooks/useActiveHackathonQuery";
import {
  getDaysLeft,
  getHoursLeft,
  formatCountdown,
} from "@/lib/hackathon-utils";

interface HackathonBottomSheetProps {
  hackathon: ActiveHackathon;
  isOpen: boolean;
  onClose: () => void;
}

export function HackathonBottomSheet({
  hackathon,
  isOpen,
  onClose,
}: HackathonBottomSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isVisible) return null;

  const hasDeadline = !!hackathon.ends_at;
  const daysLeft = hasDeadline ? getDaysLeft(hackathon.ends_at!) : null;
  const hoursLeft = hasDeadline ? getHoursLeft(hackathon.ends_at!) : null;
  const countdown = hasDeadline ? formatCountdown(hackathon.ends_at!) : null;
  const isComplete = hackathon.status === "complete";
  const isJudging = hackathon.status === "judging";
  const isUrgent =
    hasDeadline &&
    daysLeft !== null &&
    daysLeft <= 1 &&
    !isComplete &&
    !isJudging;

  // Determine status display
  let statusIcon = <Clock className="h-4 w-4" />;
  let statusColor = "text-muted-foreground";
  let statusBg = "bg-muted/50";

  if (isComplete) {
    statusIcon = <CheckCircle2 className="h-4 w-4" />;
    statusColor = "text-emerald-500";
    statusBg = "bg-emerald-500/10";
  } else if (isJudging) {
    statusColor = "text-amber-500";
    statusBg = "bg-amber-500/10";
  } else if (isUrgent) {
    statusColor = "text-red-500";
    statusBg = "bg-red-500/10";
  } else {
    statusColor = "text-emerald-500";
    statusBg = "bg-emerald-500/10";
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-xl transform transition-transform duration-200 ease-out ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle indicator */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="px-6 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20">
              <Trophy className="h-6 w-6 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {hackathon.number
                  ? `Hackathon #${hackathon.number}`
                  : hackathon.name}
              </h3>
              <div
                className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusBg} ${statusColor}`}
              >
                {statusIcon}
                <span>
                  {isComplete
                    ? "Winners Announced"
                    : isJudging
                      ? "Judging in Progress"
                      : countdown || "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Time breakdown (only for active hackathons with deadlines) */}
          {!isComplete &&
            !isJudging &&
            hasDeadline &&
            daysLeft !== null &&
            daysLeft > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="text-2xl font-bold text-foreground">
                    {daysLeft}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    day{daysLeft !== 1 ? "s" : ""} remaining
                  </div>
                </div>
                {daysLeft <= 3 && hoursLeft !== null && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="text-2xl font-bold text-foreground">
                      {Math.max(0, hoursLeft)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      hours total
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Actions */}
          <div className="space-y-3">
            {!isComplete && !isJudging && (
              <Link
                href={`/hackathons/${hackathon.slug}`}
                onClick={onClose}
                className={`flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-medium text-white transition-all ${
                  isUrgent
                    ? "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-lg shadow-red-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
                }`}
              >
                <span>Submit Now</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              href={`/hackathons/${hackathon.slug}`}
              onClick={onClose}
              className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-medium border border-border bg-card hover:bg-muted transition-colors ${
                isComplete || isJudging ? "" : "text-muted-foreground"
              }`}
            >
              <span>
                {isComplete
                  ? "View Winners"
                  : isJudging
                    ? "View Submissions"
                    : "Learn More"}
              </span>
              {(isComplete || isJudging) && <ArrowRight className="h-4 w-4" />}
            </Link>
          </div>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-safe-area-inset-bottom bg-card" />
      </div>
    </div>
  );
}
