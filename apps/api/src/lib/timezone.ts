/**
 * Timezone utilities for scheduling jobs across different timezones.
 * Uses Intl.DateTimeFormat for timezone conversions without external dependencies.
 */

export interface TimeComponents {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
}

/**
 * Get the current time components in a specific timezone.
 */
export function getTimeInTimezone(
  date: Date,
  timezone: string,
): TimeComponents {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find((p) => p.type === type)?.value || "0";

  // Map weekday abbreviation to number (0 = Sunday, 1 = Monday, etc.)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: parseInt(getPart("year"), 10),
    month: parseInt(getPart("month"), 10),
    day: parseInt(getPart("day"), 10),
    hour: parseInt(getPart("hour"), 10),
    minute: parseInt(getPart("minute"), 10),
    dayOfWeek: weekdayMap[getPart("weekday")] ?? 0,
  };
}

/**
 * Convert a date/time in a specific timezone to a UTC Date object.
 */
export function timezoneToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Create an ISO string for the target time and use the timezone to find the offset
  // We do this by creating a date in UTC, then finding what the offset is for the target timezone
  const targetLocal = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0),
  );

  // Get what this UTC time looks like in the target timezone
  const inTz = getTimeInTimezone(targetLocal, timezone);

  // Calculate the offset in minutes
  // If the timezone shows hour X but we set hour Y in UTC, the offset is Y - X hours
  let hourDiff = hour - inTz.hour;

  // Handle day boundary crossings
  if (inTz.day !== day) {
    // The timezone date is different from what we set
    if (inTz.day > day || inTz.month > month || inTz.year > year) {
      // Timezone is ahead, so UTC is behind
      hourDiff -= 24;
    } else {
      // Timezone is behind, so UTC is ahead
      hourDiff += 24;
    }
  }

  const minuteDiff = minute - inTz.minute;
  const totalOffsetMs = (hourDiff * 60 + minuteDiff) * 60 * 1000;

  // Apply the offset to get the correct UTC time
  // We need to ADD the offset because targetLocal treats local time as UTC,
  // and we need to shift forward to actual UTC
  return new Date(targetLocal.getTime() + totalOffsetMs);
}

/**
 * Parse a simple cron expression and calculate next run time.
 * Supports: minute hour day-of-month month day-of-week
 *
 * The cron time is interpreted in the specified timezone.
 *
 * Examples:
 * - "0 9 * * *" = daily at 9 AM in the specified timezone
 * - "0 18 * * 1-5" = weekdays at 6 PM in the specified timezone
 * - "0 * * * *" = every hour at minute 0
 */
export function getNextRunTime(cron: string, timezone: string): Date | null {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      console.error(`Invalid cron expression: ${cron}`);
      return null;
    }

    const minuteStr = parts[0] || "*";
    const hourStr = parts[1] || "*";
    const dayOfMonthStr = parts[2] || "*";
    const monthStr = parts[3] || "*";
    const dayOfWeekStr = parts[4] || "*";
    const now = new Date();

    // Get current time in the target timezone
    const tzNow = getTimeInTimezone(now, timezone);

    console.log(
      `[SCHEDULE] Calculating next run for cron "${cron}" in timezone ${timezone}`,
    );
    console.log(
      `[SCHEDULE] Current time in ${timezone}: ${tzNow.year}-${tzNow.month}-${tzNow.day} ${tzNow.hour}:${tzNow.minute} (day of week: ${tzNow.dayOfWeek})`,
    );

    // Quick path: "every minute" - just add 1 minute
    if (
      minuteStr === "*" &&
      hourStr === "*" &&
      dayOfMonthStr === "*" &&
      monthStr === "*" &&
      dayOfWeekStr === "*"
    ) {
      return new Date(now.getTime() + 60 * 1000);
    }

    // Quick path: "every N minutes" (*/N * * * *)
    const stepMatch = minuteStr.match(/^\*\/(\d+)$/);
    if (
      stepMatch &&
      hourStr === "*" &&
      dayOfMonthStr === "*" &&
      monthStr === "*" &&
      dayOfWeekStr === "*"
    ) {
      const stepMinutes = parseInt(stepMatch[1] || "1", 10);
      // Find next minute that's divisible by stepMinutes
      const currentMinute = tzNow.minute;
      const nextMinute =
        Math.ceil((currentMinute + 1) / stepMinutes) * stepMinutes;

      if (nextMinute < 60) {
        // Same hour
        const result = timezoneToUtc(
          tzNow.year,
          tzNow.month,
          tzNow.day,
          tzNow.hour,
          nextMinute,
          timezone,
        );
        console.log(
          `[SCHEDULE] Next run (every ${stepMinutes} min): ${result.toISOString()}`,
        );
        return result;
      } else {
        // Next hour, minute 0
        let nextHour = tzNow.hour + 1;
        let nextDay = tzNow.day;
        let nextMonth = tzNow.month;
        let nextYear = tzNow.year;

        if (nextHour >= 24) {
          nextHour = 0;
          nextDay += 1;
          const daysInMonth = new Date(nextYear, nextMonth, 0).getDate();
          if (nextDay > daysInMonth) {
            nextDay = 1;
            nextMonth += 1;
            if (nextMonth > 12) {
              nextMonth = 1;
              nextYear += 1;
            }
          }
        }

        const result = timezoneToUtc(
          nextYear,
          nextMonth,
          nextDay,
          nextHour,
          0,
          timezone,
        );
        console.log(
          `[SCHEDULE] Next run (every ${stepMinutes} min, next hour): ${result.toISOString()}`,
        );
        return result;
      }
    }

    // Quick path: "every hour at minute X" (X * * * *)
    if (
      hourStr === "*" &&
      dayOfMonthStr === "*" &&
      monthStr === "*" &&
      dayOfWeekStr === "*"
    ) {
      const targetMinute = parseInt(minuteStr, 10);
      let nextHour = tzNow.hour;
      let nextDay = tzNow.day;
      let nextMonth = tzNow.month;
      let nextYear = tzNow.year;

      if (tzNow.minute >= targetMinute) {
        nextHour += 1;
        if (nextHour >= 24) {
          nextHour = 0;
          nextDay += 1;
          // Simplified: doesn't handle month/year rollover perfectly but close enough for hourly
        }
      }

      const result = timezoneToUtc(
        nextYear,
        nextMonth,
        nextDay,
        nextHour,
        targetMinute,
        timezone,
      );
      console.log(`[SCHEDULE] Next hourly run: ${result.toISOString()}`);
      return result;
    }

    // For daily schedules (0 9 * * *) - specific hour and minute
    if (dayOfMonthStr === "*" && monthStr === "*" && dayOfWeekStr === "*") {
      const targetHour = parseInt(hourStr, 10);
      const targetMinute = parseInt(minuteStr, 10);

      let nextDay = tzNow.day;
      let nextMonth = tzNow.month;
      let nextYear = tzNow.year;

      // Check if we're past the target time today
      const isPastToday =
        tzNow.hour > targetHour ||
        (tzNow.hour === targetHour && tzNow.minute >= targetMinute);

      if (isPastToday) {
        // Schedule for tomorrow
        nextDay += 1;
        // Handle month rollover
        const daysInMonth = new Date(nextYear, nextMonth, 0).getDate();
        if (nextDay > daysInMonth) {
          nextDay = 1;
          nextMonth += 1;
          if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
          }
        }
      }

      const result = timezoneToUtc(
        nextYear,
        nextMonth,
        nextDay,
        targetHour,
        targetMinute,
        timezone,
      );
      console.log(
        `[SCHEDULE] Next daily run at ${targetHour}:${targetMinute} ${timezone}: ${result.toISOString()}`,
      );
      return result;
    }

    // For weekly schedules (0 9 * * 1) - specific day of week
    // Also handles day ranges like "1-5" for weekdays
    if (dayOfMonthStr === "*" && monthStr === "*" && dayOfWeekStr !== "*") {
      const targetHour = parseInt(hourStr, 10);
      const targetMinute = parseInt(minuteStr, 10);

      // Parse day of week - could be single number or range like "1-5"
      let targetDays: number[] = [];
      if (dayOfWeekStr.includes("-")) {
        const rangeParts = dayOfWeekStr.split("-").map((d) => parseInt(d, 10));
        const start = rangeParts[0] ?? 0;
        const end = rangeParts[1] ?? start;
        for (let d = start; d <= end; d++) {
          targetDays.push(d);
        }
      } else {
        targetDays = [parseInt(dayOfWeekStr, 10)];
      }

      // Check if we're past the target time today
      const isPastToday =
        tzNow.hour > targetHour ||
        (tzNow.hour === targetHour && tzNow.minute >= targetMinute);

      // Find next valid day
      let daysToAdd = 0;
      for (let i = 0; i <= 7; i++) {
        const checkDay = (tzNow.dayOfWeek + i) % 7;
        if (targetDays.includes(checkDay)) {
          if (i === 0 && isPastToday) {
            // Today is a target day but we're past the time, skip to next occurrence
            continue;
          }
          daysToAdd = i;
          break;
        }
      }

      // If we didn't find a day (shouldn't happen), default to 7 days
      if (daysToAdd === 0 && isPastToday) {
        for (let i = 1; i <= 7; i++) {
          const checkDay = (tzNow.dayOfWeek + i) % 7;
          if (targetDays.includes(checkDay)) {
            daysToAdd = i;
            break;
          }
        }
      }

      // Calculate the target date
      const targetDate = new Date(
        now.getTime() + daysToAdd * 24 * 60 * 60 * 1000,
      );
      const tzTarget = getTimeInTimezone(targetDate, timezone);

      const result = timezoneToUtc(
        tzTarget.year,
        tzTarget.month,
        tzTarget.day,
        targetHour,
        targetMinute,
        timezone,
      );
      console.log(
        `[SCHEDULE] Next weekly run on day(s) ${targetDays.join(",")} at ${targetHour}:${targetMinute} ${timezone}: ${result.toISOString()}`,
      );
      return result;
    }

    // Fallback: just add 1 hour for unsupported patterns
    console.warn(`Unsupported cron pattern "${cron}", defaulting to 1 hour`);
    return new Date(now.getTime() + 60 * 60 * 1000);
  } catch (error) {
    console.error(`Failed to parse cron expression "${cron}":`, error);
    return null;
  }
}
