"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useRewardsCountdown } from "@/hooks/useRewardsCountdown";

const STORAGE_KEY = "rewards-banner-dismissed";

export function RewardsBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash
  const { timeLeft, isFirst, isLive } = useRewardsCountdown();
  const pathname = usePathname();

  // Check localStorage on mount
  useEffect(() => {
    const wasDismissed = localStorage.getItem(STORAGE_KEY) === "true";
    setDismissed(wasDismissed);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  // Don't show if dismissed or already on rewards page
  if (dismissed || pathname?.startsWith("/rewards")) {
    return null;
  }

  return (
    <Link
      href="/rewards"
      className="block w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white relative group"
    >
      <div className="pl-4 pr-10 py-2.5 text-center text-xs sm:text-sm font-medium">
        <span className="mr-1">💰</span>
        {isLive ? (
          <>
            <span className="hidden xs:inline">$JOBS </span>Rewards are live!{" "}
            <span className="opacity-80">→</span>{" "}
            <span className="underline underline-offset-2 group-hover:no-underline">
              Claim
            </span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">
              {isFirst ? "First" : "Next"} $JOBS rewards{" "}
            </span>
            <span className="sm:hidden">Rewards </span>
            drop in <span className="font-mono font-bold">{timeLeft}</span>{" "}
            <span className="hidden sm:inline opacity-80">→</span>{" "}
            <span className="hidden sm:inline underline underline-offset-2 group-hover:no-underline">
              Claim yours
            </span>
          </>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </Link>
  );
}
