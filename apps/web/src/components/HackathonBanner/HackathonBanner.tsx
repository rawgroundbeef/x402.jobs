"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { isPast, parseISO } from "date-fns";
import {
  useActiveHackathonQuery,
  type ActiveHackathon,
} from "@/hooks/useActiveHackathonQuery";
import { getDaysLeft, formatCountdown } from "@/lib/hackathon-utils";

const COOKIE_NAME = "hackathon-dismissed";

// Cookie helpers
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

function setCookie(name: string, value: string, maxAge: number = 31536000) {
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/`;
}

interface BannerState {
  statusText: string;
  cta: string | null;
  isUrgent: boolean;
}

function getBannerState(hackathon: ActiveHackathon): BannerState {
  // Check hackathon status first for post-deadline states
  if (hackathon.status === "complete") {
    return { statusText: "Winners announced!", cta: "View", isUrgent: false };
  }

  if (hackathon.status === "judging") {
    return { statusText: "Judging in progress", cta: null, isUrgent: false };
  }

  // No deadline - just show submit CTA
  if (!hackathon.ends_at) {
    return { statusText: "", cta: "Submit Now", isUrgent: false };
  }

  // Parse the deadline
  const endDate = parseISO(hackathon.ends_at);

  // If deadline passed, show judging
  if (isPast(endDate)) {
    return { statusText: "Judging in progress", cta: null, isUrgent: false };
  }

  // Use shared utility for consistent countdown
  const daysLeft = getDaysLeft(hackathon.ends_at);
  const statusText = formatCountdown(hackathon.ends_at);

  if (daysLeft <= 1) {
    return {
      statusText,
      cta: "Submit Now",
      isUrgent: true,
    };
  }

  return {
    statusText,
    cta: "Submit Now",
    isUrgent: false,
  };
}

export function HackathonBanner() {
  const activeHackathonQuery = useActiveHackathonQuery();
  const hackathon = activeHackathonQuery.data?.hackathon;

  const [bannerState, setBannerState] = useState<BannerState | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Check dismissal and set initial state
  useEffect(() => {
    if (!hackathon) return;

    // Check if this hackathon was dismissed (read cookie)
    const dismissedSlug = getCookie(COOKIE_NAME);
    if (dismissedSlug === hackathon.slug) {
      return; // Stay hidden
    }

    setBannerState(getBannerState(hackathon));
    // Use requestAnimationFrame to ensure smooth fade-in after hydration
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [hackathon]);

  // Update countdown every minute
  useEffect(() => {
    if (!hackathon) return;

    const interval = setInterval(() => {
      setBannerState(getBannerState(hackathon));
    }, 60000);

    return () => clearInterval(interval);
  }, [hackathon]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hackathon) {
      setCookie(COOKIE_NAME, hackathon.slug);
      setIsVisible(false);
    }
  };

  if (!hackathon || !bannerState || !isVisible) return null;

  const { statusText, cta, isUrgent } = bannerState;
  const isComplete = hackathon.status === "complete";
  const isJudging = !cta || hackathon.status === "judging";

  const DismissButton = () => (
    <button
      onClick={handleDismiss}
      className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors"
      aria-label="Dismiss banner"
    >
      <X className="w-4 h-4" />
    </button>
  );

  // Completed or judging hackathons - neutral dark background
  if (isComplete || isJudging) {
    return (
      <div
        className="hidden lg:block w-full bg-[#1a1a1a] border-b border-[#2a2a2a] relative transition-opacity duration-300"
        style={{ opacity: isVisible ? 1 : 0 }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-2.5">
          <Link
            href={`/hackathons/${hackathon.slug}`}
            className="flex items-center justify-center gap-3 text-sm group hover:opacity-90 transition-opacity"
          >
            <span className="text-base">🏆</span>
            <span className="font-medium text-white/90">
              {hackathon.number
                ? `Hackathon #${hackathon.number}`
                : hackathon.name}
            </span>
            <span className="text-white/40">—</span>
            <span
              className={`font-medium ${isComplete ? "text-emerald-400" : "text-amber-400"}`}
            >
              {statusText}
            </span>
            {cta && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium group-hover:underline">
                {cta}
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            )}
          </Link>
        </div>
        <DismissButton />
      </div>
    );
  }

  // Active hackathon with countdown
  return (
    <div
      className="hidden lg:block w-full bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-b border-emerald-500/20 hover:from-emerald-500/[0.12] hover:to-emerald-500/[0.07] transition-all duration-300 relative"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="max-w-screen-2xl mx-auto px-6 py-2.5">
        <Link
          href={`/hackathons/${hackathon.slug}`}
          className="flex items-center justify-center gap-3 text-sm group"
        >
          <span className="text-base">🏆</span>
          <span className="font-medium text-foreground">
            {hackathon.number
              ? `Hackathon #${hackathon.number}`
              : hackathon.name}
          </span>
          {statusText && (
            <>
              <span className="text-muted-foreground">—</span>
              <span
                className={`font-medium ${isUrgent ? "text-amber-500" : "text-muted-foreground"}`}
              >
                {statusText}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1 text-emerald-500 font-medium group-hover:underline">
            {cta}
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </div>
      <DismissButton />
    </div>
  );
}
