"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import { publicFetcher } from "@/lib/api";
import {
  Briefcase,
  ChevronRight,
  Plus,
  Search,
  DollarSign,
  Clock,
  Users,
} from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";

interface HiringRequest {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  tags: string[];
  bounty_amount: number;
  posting_fee_amount: number;
  escrow_status: "none" | "funded" | "released" | "refunded";
  status: "open" | "under_review" | "fulfilled" | "canceled" | "expired";
  creator_username?: string;
  submission_count?: number;
  created_at: string;
  expires_at?: string;
}

interface HiringStats {
  openRequests: number;
  totalBountyPool: number;
  totalPaidOut: number;
  totalSubmissions: number;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  under_review: {
    label: "Under Review",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  canceled: {
    label: "Canceled",
    className: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  },
  expired: {
    label: "Expired",
    className: "bg-red-500/10 text-red-500 border-red-500/20",
  },
};

const ESCROW_BADGES: Record<string, { label: string; className: string }> = {
  none: {
    label: "Not Funded",
    className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
  funded: {
    label: "Funded",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  released: {
    label: "Released",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  refunded: {
    label: "Refunded",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function HiringListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (search) queryParams.set("q", search);

  const { data, isLoading } = useSWR<{
    requests: HiringRequest[];
    total: number;
  }>(`/bounties/requests?${queryParams.toString()}`, publicFetcher);

  const { data: stats } = useSWR<HiringStats>("/bounties/stats", publicFetcher);

  const requests = data?.requests || [];

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title="Bounties"
        description="Create a bounty. Get a job built."
        rightSlot={
          <Button as={Link} href="/bounties/create" variant="primary">
            <Plus className="w-4 h-4" />
            Post Bounty
          </Button>
        }
      />

      {/* How it works */}
      <div className="mb-8 p-4 rounded-xl bg-muted/30 border border-border/50">
        <p className="text-sm text-muted-foreground text-center">
          <span className="font-medium text-foreground">How it works:</span>{" "}
          Describe what you need → Developer builds it → Test it → Pay the
          bounty
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.openRequests}</p>
                <p className="text-sm text-muted-foreground">Open Bounties</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalBountyPool)}
                </p>
                <p className="text-sm text-muted-foreground">Bounty Pool</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalPaidOut)}
                </p>
                <p className="text-sm text-muted-foreground">Paid Out</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                <p className="text-sm text-muted-foreground">Submissions</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search bounties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {["open", "under_review", "fulfilled", ""].map((status) => (
            <Button
              key={status || "all"}
              variant={statusFilter === status ? "primary" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {status === "" ? "All" : STATUS_BADGES[status]?.label || status}
            </Button>
          ))}
        </div>
      </div>

      {/* Request List */}
      <main className="w-full pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20">
            <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">
              No open bounties yet
            </p>
            <p className="text-muted-foreground mb-4">
              Be the first to post one and get your job built.
            </p>
            {user ? (
              <Button as={Link} href="/bounties/create" variant="primary">
                <Plus className="w-4 h-4" />
                Post a Bounty
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to post a bounty
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const statusBadge = STATUS_BADGES[request.status];
              const escrowBadge = ESCROW_BADGES[request.escrow_status];

              return (
                <Link
                  key={request.id}
                  href={`/bounties/${request.id}`}
                  className="block"
                >
                  <Card className="p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Briefcase className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold truncate">{request.title}</p>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                          {request.escrow_status === "funded" && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full border ${escrowBadge.className}`}
                            >
                              {escrowBadge.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {request.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          {request.creator_username && (
                            <span className="text-muted-foreground">
                              by @{request.creator_username}
                            </span>
                          )}
                          {request.tags.length > 0 && (
                            <div className="flex gap-1">
                              {request.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 text-xs bg-muted rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-lg font-bold text-amber-500">
                          {formatCurrency(request.bounty_amount)}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {request.submission_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(request.created_at)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </BaseLayout>
  );
}
