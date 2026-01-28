"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Card } from "@x402jobs/ui/card";

interface LeaderboardItem {
  id: string;
  name: string;
  href: string;
  value?: string;
  icon?: string | null; // favicon/avatar URL
}

interface LeaderboardCardProps {
  title: string;
  titleHref: string;
  icon: LucideIcon;
  iconColor: string;
  items: LeaderboardItem[];
  emptyMessage?: string;
}

export function LeaderboardCard({
  title,
  titleHref,
  icon: Icon,
  items,
  emptyMessage = "No data yet",
}: LeaderboardCardProps) {
  return (
    <Card className="p-4">
      <Link
        href={titleHref}
        className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2 hover:text-foreground/80 transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </Link>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.slice(0, 5).map((item, i) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center justify-between text-sm gap-2 hover:bg-accent/50 -mx-1 px-1 py-0.5 rounded transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-muted-foreground w-4 shrink-0">
                  {i + 1}.
                </span>
                {item.icon && (
                  <img
                    src={item.icon}
                    alt=""
                    className="w-4 h-4 rounded shrink-0 object-contain"
                  />
                )}
                <span className="truncate text-foreground/80 hover:text-foreground">
                  {item.name}
                </span>
              </div>
              {item.value && (
                <span className="text-muted-foreground font-mono text-xs shrink-0">
                  {item.value}
                </span>
              )}
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </div>
    </Card>
  );
}
