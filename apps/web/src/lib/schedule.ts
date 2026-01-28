/**
 * Schedule/Cron utilities for flexible interval scheduling
 */

export type IntervalUnit = "minutes" | "hours" | "days";

export interface IntervalConfig {
  value: number;
  unit: IntervalUnit;
}

export interface SchedulePreset {
  id: string;
  label: string;
  cron: string;
  description: string;
  interval?: IntervalConfig; // If expressible as interval
  isSpecial?: boolean; // For weekdays, specific days, etc.
}

// Quick preset options (limited to 4 for single-row display)
export const SCHEDULE_PRESETS: SchedulePreset[] = [
  {
    id: "hourly",
    label: "Hourly",
    cron: "0 * * * *",
    description: "At minute 0 of every hour",
    interval: { value: 1, unit: "hours" },
  },
  {
    id: "daily_9am",
    label: "Daily 9 AM",
    cron: "0 9 * * *",
    description: "Every day at 9:00 AM",
    interval: { value: 1, unit: "days" },
  },
  {
    id: "daily_6pm",
    label: "Daily 6 PM",
    cron: "0 18 * * *",
    description: "Every day at 6:00 PM",
  },
  {
    id: "weekdays",
    label: "Weekdays",
    cron: "0 9 * * 1-5",
    description: "Monday-Friday at 9:00 AM",
    isSpecial: true,
  },
];

// Available interval values for dropdowns
export const INTERVAL_VALUES = {
  minutes: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60],
  hours: [1, 2, 3, 4, 6, 8, 12, 24],
  days: [1, 2, 3, 7, 14, 30],
};

// Common timezones
export const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
];

/**
 * Convert interval to cron expression
 */
export function intervalToCron(value: number, unit: IntervalUnit): string {
  switch (unit) {
    case "minutes":
      if (value === 1) return "* * * * *";
      return `*/${value} * * * *`;
    case "hours":
      if (value === 1) return "0 * * * *";
      return `0 */${value} * * *`;
    case "days":
      if (value === 1) return "0 0 * * *";
      if (value === 7) return "0 0 * * 0"; // Weekly (Sunday)
      // For other day intervals, we use every Nth day of month
      return `0 0 */${value} * *`;
    default:
      return "0 * * * *"; // Default to hourly
  }
}

/**
 * Try to parse a cron expression back to an interval
 * Returns null if it can't be expressed as a simple interval
 */
export function cronToInterval(cron: string): IntervalConfig | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute, hour, day, month, weekday] = parts;

  // Check for minute-based intervals: */N * * * * or * * * * *
  if (hour === "*" && day === "*" && month === "*" && weekday === "*") {
    if (minute === "*") return { value: 1, unit: "minutes" };
    const match = minute.match(/^\*\/(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 1 && val <= 60) return { value: val, unit: "minutes" };
    }
  }

  // Check for hour-based intervals: 0 */N * * * or 0 * * * *
  if (minute === "0" && day === "*" && month === "*" && weekday === "*") {
    if (hour === "*") return { value: 1, unit: "hours" };
    const match = hour.match(/^\*\/(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 1 && val <= 24) return { value: val, unit: "hours" };
    }
  }

  // Check for daily: 0 0 * * * or 0 N * * * (daily at specific hour)
  if (
    minute === "0" &&
    /^\d+$/.test(hour) &&
    day === "*" &&
    month === "*" &&
    weekday === "*"
  ) {
    return { value: 1, unit: "days" };
  }

  // Check for day intervals: 0 0 */N * *
  if (minute === "0" && hour === "0" && month === "*" && weekday === "*") {
    if (day === "*") return { value: 1, unit: "days" };
    const match = day.match(/^\*\/(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 1 && val <= 30) return { value: val, unit: "days" };
    }
  }

  // Check for weekly: 0 0 * * 0
  if (
    minute === "0" &&
    hour === "0" &&
    day === "*" &&
    month === "*" &&
    weekday === "0"
  ) {
    return { value: 7, unit: "days" };
  }

  return null;
}

/**
 * Get a human-readable description of a cron expression
 */
export function cronToHuman(cron: string): string {
  const interval = cronToInterval(cron);
  if (interval) {
    return intervalToHuman(interval.value, interval.unit);
  }

  // Check for preset matches
  const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron);
  if (preset) {
    return preset.description;
  }

  // Try to parse common patterns
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, day, month, weekday] = parts;

  // Weekdays: 0 9 * * 1-5
  if (weekday === "1-5" && day === "*" && month === "*") {
    return `Weekdays at ${formatHour(minute, hour)}`;
  }

  // Specific weekday: 0 9 * * 1
  if (/^[0-6]$/.test(weekday) && day === "*" && month === "*") {
    const dayName = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][parseInt(weekday, 10)];
    return `${dayName}s at ${formatHour(minute, hour)}`;
  }

  // Specific day of month: 0 9 1 * *
  if (/^\d+$/.test(day) && month === "*" && weekday === "*") {
    const dayNum = parseInt(day, 10);
    const suffix =
      dayNum === 1 ? "st" : dayNum === 2 ? "nd" : dayNum === 3 ? "rd" : "th";
    return `${dayNum}${suffix} of month at ${formatHour(minute, hour)}`;
  }

  return cron;
}

function formatHour(minute: string, hour: string): string {
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  if (isNaN(h) || isNaN(m)) return `${hour}:${minute}`;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${displayHour} ${period}`
    : `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Convert interval to human-readable description
 */
export function intervalToHuman(value: number, unit: IntervalUnit): string {
  if (value === 1) {
    return `Every ${unit.slice(0, -1)}`; // "Every minute", "Every hour", "Every day"
  }
  return `Every ${value} ${unit}`;
}

/**
 * Calculate runs per day for an interval
 */
export function runsPerDay(value: number, unit: IntervalUnit): number {
  switch (unit) {
    case "minutes":
      return Math.floor(1440 / value); // 1440 minutes per day
    case "hours":
      return Math.floor(24 / value);
    case "days":
      return 1 / value;
    default:
      return 1;
  }
}

/**
 * Calculate estimated daily cost
 */
export function estimatedDailyCost(
  intervalValue: number,
  intervalUnit: IntervalUnit,
  costPerRun: number,
): { runs: number; cost: number } {
  const runs = runsPerDay(intervalValue, intervalUnit);
  return {
    runs: Math.round(runs * 100) / 100, // Round to 2 decimals
    cost: Math.round(runs * costPerRun * 100) / 100,
  };
}

/**
 * Check if schedule should show a warning
 * Only warn if: runs > 500/day OR cost > $50/day
 */
export function hasScheduleWarning(
  intervalValue: number,
  intervalUnit: IntervalUnit,
  costPerRun: number,
): boolean {
  const runs = runsPerDay(intervalValue, intervalUnit);
  const dailyCost = runs * costPerRun;
  return runs > 500 || dailyCost > 50;
}

/**
 * Format the cost warning message
 */
export function formatCostWarning(
  intervalValue: number,
  intervalUnit: IntervalUnit,
  costPerRun: number,
): string {
  const { runs, cost } = estimatedDailyCost(
    intervalValue,
    intervalUnit,
    costPerRun,
  );
  if (runs >= 1) {
    return `This will run ${runs.toLocaleString()} times/day ($${cost.toFixed(2)})`;
  }
  const runsPerWeek = runs * 7;
  return `This will run ${runsPerWeek.toFixed(1)} times/week ($${(cost * 7).toFixed(2)})`;
}
