"use client";

import { useEffect, useState } from "react";
import { Trophy, Check } from "lucide-react";
import {
  useActiveHackathonQuery,
  type ActiveHackathon,
} from "@/hooks/useActiveHackathonQuery";
import { getDaysLeft, getHoursLeft } from "@/lib/hackathon-utils";
import { HackathonBottomSheet } from "./HackathonBottomSheet";

const COOKIE_NAME = "hackathon-dismissed";

// Cookie helpers
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

interface BadgeState {
  text: string;
  isUrgent: boolean;
  isComplete: boolean;
  isJudging: boolean;
}

function getBadgeState(hackathon: ActiveHackathon): BadgeState {
  if (hackathon.status === "complete") {
    return { text: "✓", isUrgent: false, isComplete: true, isJudging: false };
  }

  if (hackathon.status === "judging") {
    return {
      text: "Judging",
      isUrgent: false,
      isComplete: false,
      isJudging: true,
    };
  }

  // No deadline - show active state
  if (!hackathon.ends_at) {
    return {
      text: "Active",
      isUrgent: false,
      isComplete: false,
      isJudging: false,
    };
  }

  const daysLeft = getDaysLeft(hackathon.ends_at);
  const hoursLeft = getHoursLeft(hackathon.ends_at);

  if (daysLeft <= 0) {
    return {
      text: "Ended",
      isUrgent: false,
      isComplete: false,
      isJudging: false,
    };
  }

  if (daysLeft === 1 && hoursLeft <= 24) {
    if (hoursLeft <= 1) {
      return {
        text: "<1h",
        isUrgent: true,
        isComplete: false,
        isJudging: false,
      };
    }
    return {
      text: `${hoursLeft}h`,
      isUrgent: true,
      isComplete: false,
      isJudging: false,
    };
  }

  return {
    text: `${daysLeft}d`,
    isUrgent: daysLeft <= 1,
    isComplete: false,
    isJudging: false,
  };
}

export function HackathonBadge() {
  const activeHackathonQuery = useActiveHackathonQuery();
  const hackathon = activeHackathonQuery.data?.hackathon;

  const [badgeState, setBadgeState] = useState<BadgeState | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Check dismissal and set initial state
  useEffect(() => {
    if (!hackathon) return;

    const dismissedSlug = getCookie(COOKIE_NAME);
    if (dismissedSlug === hackathon.slug) {
      return; // Stay hidden
    }

    setBadgeState(getBadgeState(hackathon));
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, [hackathon]);

  // Update countdown every minute
  useEffect(() => {
    if (!hackathon) return;

    const interval = setInterval(() => {
      setBadgeState(getBadgeState(hackathon));
    }, 60000);

    return () => clearInterval(interval);
  }, [hackathon]);

  if (!hackathon || !badgeState || !isVisible) return null;

  const { text, isUrgent, isComplete, isJudging } = badgeState;

  // Determine badge styling based on state
  let badgeClasses = "bg-emerald-500/15 border-emerald-500/30 text-emerald-500";
  if (isComplete) {
    badgeClasses = "bg-muted/50 border-border text-muted-foreground";
  } else if (isJudging) {
    badgeClasses = "bg-amber-500/15 border-amber-500/30 text-amber-500";
  } else if (isUrgent) {
    badgeClasses = "bg-red-500/15 border-red-500/30 text-red-500";
  }

  return (
    <>
      <button
        onClick={() => setIsSheetOpen(true)}
        className={`lg:hidden flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all active:scale-95 ${badgeClasses}`}
        aria-label={`Hackathon: ${hackathon.name}`}
      >
        {isComplete ? (
          <Check className="h-3 w-3" />
        ) : (
          <Trophy className="h-3 w-3" />
        )}
        <span>{text}</span>
      </button>

      <HackathonBottomSheet
        hackathon={hackathon}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </>
  );
}
