"use client";

import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { DollarSign, Zap, ChevronRight, Clock } from "lucide-react";
import { formatUsd } from "@/lib/format";
import type { ActivityEvent } from "@/types/dashboard";

interface Props {
  events: ActivityEvent[] | undefined;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RecentActivity({ events }: Props) {
  if (!events || events.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <Card className="p-8">
          <div className="text-center">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-2">No recent activity</p>
            <p className="text-sm text-muted-foreground">
              Activity will appear here when your jobs are run or resources are
              called
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <Link
          href="/dashboard/history"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <Card className="divide-y divide-border">
        {events.map((event) => (
          <div
            key={event.id}
            className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                event.type === "earning"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}
            >
              {event.type === "earning" ? (
                <DollarSign className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{event.itemName}</span>
                {event.type === "earning" && event.amount !== undefined && (
                  <span className="text-emerald-500 font-mono ml-2">
                    +{formatUsd(event.amount)}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {event.type === "earning" ? "earned" : "was called"}
              </p>
            </div>

            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
