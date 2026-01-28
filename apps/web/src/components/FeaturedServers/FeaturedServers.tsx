"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ListCard } from "@/components/ListCard";
import { formatUsd } from "@/lib/format";

interface PublicServer {
  id: string;
  slug: string;
  name: string;
  origin_url: string;
  favicon_url: string | null;
  resource_count: number;
  total_earned_usdc: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

export function FeaturedServers() {
  const [servers, setServers] = useState<PublicServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServers() {
      try {
        const res = await fetch(`${API_BASE}/servers?sort=popular&limit=4`);
        if (res.ok) {
          const data = await res.json();
          setServers(data.servers || []);
        }
      } catch (e) {
        console.error("Failed to fetch public servers:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchServers();
  }, []);

  if (loading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
          Featured Servers
        </h2>
        <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 bg-muted/30 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (servers.length === 0) {
    return null;
  }

  return (
    <div className="py-8 px-4 sm:px-6">
      <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        Featured Servers
      </h2>
      <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
        {servers.map((server) => {
          const hostname = (() => {
            try {
              return new URL(server.origin_url).hostname;
            } catch {
              return server.origin_url;
            }
          })();
          const earnings = server.total_earned_usdc
            ? parseFloat(server.total_earned_usdc)
            : 0;
          return (
            <ListCard
              key={server.id}
              href={`/servers/${server.slug}`}
              avatarUrl={server.favicon_url}
              name={server.slug || server.name}
              description={hostname}
              price={earnings > 0 ? formatUsd(earnings) : undefined}
              priceSuffix="earned"
              countLabel={`${server.resource_count} ${server.resource_count === 1 ? "resource" : "resources"}`}
              type="server"
              variant="featured"
            />
          );
        })}
      </div>
      <div className="text-center mt-6">
        <Link
          href="/servers"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          Browse all servers
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
