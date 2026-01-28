"use client";

import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { ChevronRight, Briefcase, Box, Trophy } from "lucide-react";
import { formatUsd } from "@/lib/format";
import type { TopPerformer } from "@/types/dashboard";

interface Props {
  items: TopPerformer[] | undefined;
}

export function TopPerformers({ items }: Props) {
  if (!items || items.length === 0) {
    return null;
  }

  const getItemLink = (item: TopPerformer) => {
    if (item.type === "job") {
      return item.ownerUsername
        ? `/${item.ownerUsername}/${item.slug}`
        : `/jobs`;
    }
    return item.serverSlug
      ? `/resources/${item.serverSlug}/${item.slug}`
      : `/resources`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Top Performers</h2>
        </div>
        <Link
          href="/dashboard/jobs"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View All
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item, index) => (
          <Link key={item.id} href={getItemLink(item)}>
            <Card className="p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 cursor-pointer h-full">
              <div className="flex items-start gap-3">
                <div className="relative">
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      {item.type === "job" ? (
                        <Briefcase className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Box className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  {index === 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        1
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{item.name}</h3>
                    <Badge
                      variant={item.type === "job" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.type === "job" ? "Job" : "Resource"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-500 font-bold font-mono">
                      {formatUsd(item.earnings)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.runCount} {item.type === "job" ? "runs" : "calls"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
