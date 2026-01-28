"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { ListCard } from "@/components/ListCard";
import { formatUsd } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";

interface PublicResource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  server_slug: string;
  max_amount_required: string | null;
  total_earned_usdc: string | null;
  call_count: number;
  avatar_url: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

export function FeaturedResources() {
  const router = useRouter();
  const { user } = useAuth();
  const { openRegisterResource } = useModals();
  const isAuthenticated = !!user;

  const [resources, setResources] = useState<PublicResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/resources?sort=popular&limit=4`,
        );
        if (res.ok) {
          const data = await res.json();
          setResources(data.resources || []);
        }
      } catch (e) {
        console.error("Failed to fetch public resources:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchResources();
  }, []);

  if (loading) {
    return (
      <div className="py-8 px-4 sm:px-6">
        <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
          Featured Resources
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

  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="py-8 px-4 sm:px-6">
      <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        Featured Resources
      </h2>
      <div className="grid md:grid-cols-2 gap-4 md:gap-6 max-w-5xl mx-auto">
        {resources.map((resource) => {
          const earnings = resource.total_earned_usdc
            ? parseFloat(resource.total_earned_usdc)
            : 0;
          return (
            <ListCard
              key={resource.id}
              href={`/resources/${resource.server_slug}/${resource.slug}`}
              avatarUrl={resource.avatar_url}
              name={`${resource.server_slug}/${resource.slug}`}
              description={resource.description}
              price={earnings > 0 ? formatUsd(earnings) : undefined}
              priceSuffix="earned"
              countLabel={
                resource.call_count > 0
                  ? `${resource.call_count.toLocaleString()} calls`
                  : undefined
              }
              type="resource"
              variant="featured"
            />
          );
        })}
      </div>
      <div className="text-center mt-6 space-y-3">
        <Link
          href="/resources"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          Browse all resources
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <p className="text-sm text-muted-foreground">
          Have an x402 resource?{" "}
          <button
            onClick={() => {
              if (isAuthenticated) {
                openRegisterResource();
              } else {
                router.push("/login");
              }
            }}
            className="text-foreground hover:underline font-medium"
          >
            Register it and earn when jobs use it →
          </button>
        </p>
      </div>
    </div>
  );
}
