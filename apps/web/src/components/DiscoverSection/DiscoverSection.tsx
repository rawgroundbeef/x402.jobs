"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { getSuccessRateColor } from "@/lib/format";
import { cn } from "@x402jobs/ui/utils";

interface ResourceData {
  id: string;
  slug?: string;
  name: string;
  avatar_url?: string;
  server_slug?: string;
  call_count?: number;
  success_count_30d?: number;
  failure_count_30d?: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

function getSuccessRate(
  successCount: number | null | undefined,
  failureCount: number | null | undefined,
): number {
  const success = successCount ?? 0;
  const failure = failureCount ?? 0;
  const total = success + failure;
  if (total === 0) return 100;
  return Math.round((success / total) * 100);
}

export function DiscoverSection() {
  const [resources, setResources] = useState<ResourceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/resources?sort=popular&limit=5`,
        );
        if (res.ok) {
          const data = await res.json();
          setResources(data.resources || []);
        }
      } catch (e) {
        console.error("Failed to fetch resources:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchResources();
  }, []);

  if (loading) {
    return (
      <div className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-12 w-full bg-muted rounded animate-pulse" />
            <div className="h-12 w-3/4 bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="py-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        {/* Left: Text */}
        <div>
          <p className="text-sm uppercase tracking-widest text-muted-foreground mb-4">
            x402 Registry API
          </p>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
            Discover x402 resources you can trust.
          </h2>

          <p className="text-muted-foreground mb-8 text-lg">
            Register yours. Find others. One API.
            <br />
            $50/month or pay per lookup.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="px-8 text-white border-0"
              style={{
                background:
                  "linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #8b5cf6)",
              }}
            >
              <Link href="/developers">Get API Access</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/resources">Browse Resources</Link>
            </Button>
          </div>
        </div>

        {/* Right: Leaderboard Preview */}
        <div className="relative">
          {/* Subtle glow behind */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 blur-3xl rounded-full" />

          <div className="relative flex flex-col gap-4">
            {resources.map((resource, index) => {
              const successRate = getSuccessRate(
                resource.success_count_30d,
                resource.failure_count_30d,
              );
              const displayName =
                resource.server_slug && resource.slug
                  ? `${resource.server_slug}/${resource.slug}`
                  : resource.name;

              return (
                <Link
                  key={resource.id}
                  href={`/resources/${resource.server_slug}/${resource.slug}`}
                >
                  <Card className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                    <span className="text-2xl font-bold text-muted-foreground w-8">
                      #{index + 1}
                    </span>
                    {resource.avatar_url ? (
                      <img
                        src={resource.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-sm text-muted-foreground">
                          {resource.slug?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {resource.call_count?.toLocaleString() || 0} calls
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-bold",
                          getSuccessRateColor(successRate),
                        )}
                      >
                        {successRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">success</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
