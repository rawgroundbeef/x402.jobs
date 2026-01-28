import { useState, useEffect } from "react";

// Get next snapshot time (first day of month at midnight EST = 05:00 UTC)
export function getNextSnapshotTime(): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  // First day of CURRENT month at 05:00 UTC (midnight EST)
  const thisMonth = new Date(Date.UTC(year, month, 1, 5, 0, 0));

  // If we haven't passed it yet, use current month's 1st
  if (now < thisMonth) {
    return thisMonth;
  }

  // Otherwise, use next month's 1st
  return new Date(Date.UTC(year, month + 1, 1, 5, 0, 0));
}

// Check if this is the first snapshot (before Jan 1, 2025)
export function isFirstSnapshot(): boolean {
  const firstSnapshotDate = new Date(Date.UTC(2025, 0, 1, 5, 0, 0)); // Jan 1, 2025 05:00 UTC
  return new Date() < firstSnapshotDate;
}

// Check if rewards are currently "live" (within first 3 days of the month after snapshot)
export function isRewardsLive(): boolean {
  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const hourUTC = now.getUTCHours();

  // Live if we're on day 1-3 of the month AND past 05:00 UTC on day 1
  if (dayOfMonth === 1) {
    return hourUTC >= 5; // After midnight EST on the 1st
  }
  return dayOfMonth <= 3; // Days 2-3 are always "live"
}

export function useRewardsCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [isFirst] = useState(isFirstSnapshot());
  const [isLive, setIsLive] = useState(isRewardsLive());

  useEffect(() => {
    const updateCountdown = () => {
      // Check if rewards are live
      setIsLive(isRewardsLive());

      const target = getNextSnapshotTime();
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Show days when more than 24 hours away
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(
          `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
        );
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return { timeLeft, isFirst, isLive };
}
