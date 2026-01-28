import { differenceInHours, parseISO } from "date-fns";

/**
 * Calculate days remaining until hackathon ends
 * Uses ceiling so "less than 1 day" still shows as "1 day left"
 * Returns Infinity if no deadline (endsAt is null)
 */
export function getDaysLeft(endsAt: string | Date | null): number {
  if (!endsAt) return Infinity;
  const end = typeof endsAt === "string" ? parseISO(endsAt) : endsAt;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get hours remaining (for final day display)
 * Returns Infinity if no deadline (endsAt is null)
 */
export function getHoursLeft(endsAt: string | Date | null): number {
  if (!endsAt) return Infinity;
  const end = typeof endsAt === "string" ? parseISO(endsAt) : endsAt;
  return differenceInHours(end, new Date());
}

/**
 * Format the countdown text for display
 * Returns "No deadline" if endsAt is null
 */
export function formatCountdown(endsAt: string | Date | null): string {
  if (!endsAt) return "No deadline";
  const daysLeft = getDaysLeft(endsAt);
  const hoursLeft = getHoursLeft(endsAt);

  if (daysLeft <= 0) {
    return "Ended";
  }
  if (daysLeft === 1 && hoursLeft <= 24) {
    return hoursLeft <= 1 ? "Last hour!" : `${hoursLeft} hours left`;
  }
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/**
 * Calculate progress percentage (0-100)
 * Returns 0 if no deadline (endsAt is null)
 */
export function getProgressPercentage(
  startsAt: string | Date,
  endsAt: string | Date | null,
): number {
  if (!endsAt) return 0;
  const start = typeof startsAt === "string" ? parseISO(startsAt) : startsAt;
  const end = typeof endsAt === "string" ? parseISO(endsAt) : endsAt;
  const now = new Date();

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

/**
 * Format prize amount (removes decimals if whole number)
 */
export function formatPrize(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}
