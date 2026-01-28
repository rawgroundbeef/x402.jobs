"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { Progress } from "@x402jobs/ui/progress";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import {
  formatCountdown,
  getProgressPercentage,
  formatPrize,
} from "@/lib/hackathon-utils";
import { formatUsd } from "@/lib/format";
import { ArrowRight, Trophy } from "lucide-react";

interface Sponsor {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  x_url: string | null;
  telegram_url: string | null;
  display_name: string | null;
  representative_x_url: string | null;
  contribution_amount: number;
}

interface Hackathon {
  id: string;
  slug: string;
  name: string;
  number: number | null; // Sequential hackathon number (1, 2, 3...)
  description: string | null;
  prize: number; // Single winner-take-all prize
  prizes?: { first: number; second: number; third: number }; // Legacy
  starts_at: string;
  ends_at: string;
  resolved_at: string | null;
  status: "upcoming" | "active" | "judging" | "complete";
  submissionCount: number;
  sponsors: Sponsor[];
  winners: Array<{
    place: number;
    prize_amount: number;
    submission: {
      submitter_username?: string;
      x_post_url: string | null;
      job?: {
        name: string;
        slug: string;
        owner_username: string;
      };
    };
  }>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

// Winner-take-all, just one winner

export default function HackathonsListPage() {
  const [hackathons, setHackathons] = useState<Hackathon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHackathons() {
      try {
        const res = await fetch(`${API_BASE}/hackathons`);
        if (res.ok) {
          const data = await res.json();
          setHackathons(data.hackathons || []);
        }
      } catch (e) {
        console.error("Failed to fetch hackathons:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchHackathons();
  }, []);

  // Check end date too - hackathon might have ended but status not updated
  // If ends_at is null, there's no deadline so treat as still active
  const now = new Date();
  const activeHackathons = hackathons.filter(
    (h) => h.status === "active" && (!h.ends_at || new Date(h.ends_at) > now),
  );
  const judgingHackathons = hackathons.filter(
    (h) =>
      h.status === "judging" ||
      (h.status === "active" && h.ends_at && new Date(h.ends_at) <= now),
  );
  const pastHackathons = hackathons.filter((h) => h.status === "complete");

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title="Hackathons"
        description="Compete. Build the best jobs. Win prizes."
      />

      <main className="pb-16">
        {/* Active Hackathons */}
        {activeHackathons.map((hackathon) => {
          const timeText = formatCountdown(hackathon.ends_at);
          const progress = getProgressPercentage(
            hackathon.starts_at,
            hackathon.ends_at,
          );
          // Use new prize field or calculate from legacy prizes
          const totalPrize =
            hackathon.prize ||
            (hackathon.prizes
              ? hackathon.prizes.first +
                hackathon.prizes.second +
                hackathon.prizes.third
              : 0);

          return (
            <section key={hackathon.id} className="py-8">
              <div className="border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-lg p-6">
                {/* Title */}
                <h2 className="text-2xl font-bold flex items-center gap-3 mb-4">
                  <span>🏆</span>
                  {hackathon.number
                    ? `Hackathon #${hackathon.number}`
                    : hackathon.name}
                </h2>

                {/* Description */}
                {hackathon.description && (
                  <p className="text-muted-foreground mb-6 max-w-2xl">
                    {hackathon.description}
                  </p>
                )}

                {/* Stats row */}
                <div className="flex items-center gap-2 text-sm mb-6">
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatPrize(totalPrize)} prize
                  </span>
                  {hackathon.ends_at && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {timeText}
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {hackathon.submissionCount} submission
                    {hackathon.submissionCount === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Progress bar - gradient - only show if there's a deadline */}
                {hackathon.ends_at && (
                  <div className="mb-6 max-w-xl">
                    <Progress
                      value={progress}
                      max={100}
                      variant="gradient"
                      className="h-2"
                    />
                  </div>
                )}

                {/* Sponsors */}
                {hackathon.sponsors && hackathon.sponsors.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      Sponsored by
                    </p>
                    <div className="flex items-center gap-4">
                      {hackathon.sponsors.map((sponsor) => (
                        <div
                          key={sponsor.id}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          {sponsor.image_url && (
                            <img
                              src={sponsor.image_url}
                              alt={sponsor.name}
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-border shadow-sm"
                            />
                          )}
                          {sponsor.display_name &&
                          sponsor.representative_x_url ? (
                            <span>
                              <a
                                href={sponsor.representative_x_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                              >
                                @{sponsor.display_name}
                              </a>
                              {" ("}
                              <a
                                href={sponsor.x_url || sponsor.website || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                              >
                                {sponsor.name}
                              </a>
                              {")"}
                            </span>
                          ) : (
                            <a
                              href={sponsor.x_url || sponsor.website || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-foreground transition-colors"
                            >
                              {sponsor.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <Link
                  href={`/hackathons/${hackathon.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  View Details & Submit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          );
        })}

        {/* Judging Hackathons */}
        {judgingHackathons.length > 0 && (
          <section className="py-10 mt-4 border-t border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              ⏳ Judging in Progress
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {judgingHackathons.map((hackathon) => {
                const totalPrize =
                  hackathon.prize ||
                  (hackathon.prizes
                    ? hackathon.prizes.first +
                      hackathon.prizes.second +
                      hackathon.prizes.third
                    : 0);

                return (
                  <Link
                    key={hackathon.id}
                    href={`/hackathons/${hackathon.slug}`}
                  >
                    <Card className="p-5 border-amber-500/30 transition-all hover:border-amber-500/50 hover:shadow-md hover:scale-[1.01] cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold">
                          {hackathon.number
                            ? `Hackathon #${hackathon.number}`
                            : hackathon.name}
                        </h3>
                        {/* Overlapping sponsor avatars */}
                        {hackathon.sponsors &&
                          hackathon.sponsors.length > 0 && (
                            <div className="flex -space-x-2">
                              {hackathon.sponsors.map((sponsor) => (
                                <img
                                  key={sponsor.id}
                                  src={sponsor.image_url || ""}
                                  alt={sponsor.name}
                                  title={sponsor.name}
                                  className="h-7 w-7 rounded-full object-cover ring-2 ring-background shadow-sm"
                                />
                              ))}
                            </div>
                          )}
                      </div>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                        {formatPrize(totalPrize)}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {hackathon.submissionCount} submission
                        {hackathon.submissionCount === 1 ? "" : "s"}
                      </p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                        Submissions closed — Winner coming soon
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm text-primary">
                        View submissions
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Past Hackathons */}
        {pastHackathons.length > 0 && (
          <section className="py-10 mt-4 border-t border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              Past Hackathons
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {pastHackathons.map((hackathon) => {
                const winner =
                  hackathon.winners.length > 0 ? hackathon.winners[0] : null;
                const totalPrize =
                  hackathon.prize ||
                  (hackathon.prizes
                    ? hackathon.prizes.first +
                      hackathon.prizes.second +
                      hackathon.prizes.third
                    : 0);

                return (
                  <Link
                    key={hackathon.id}
                    href={`/hackathons/${hackathon.slug}`}
                  >
                    <Card className="p-5 transition-all hover:border-border/80 hover:shadow-md hover:scale-[1.01] cursor-pointer">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold">
                          {hackathon.number
                            ? `Hackathon #${hackathon.number}`
                            : hackathon.name}
                        </h3>
                        {/* Overlapping sponsor avatars */}
                        {hackathon.sponsors &&
                          hackathon.sponsors.length > 0 && (
                            <div className="flex -space-x-2">
                              {hackathon.sponsors.map((sponsor) => (
                                <img
                                  key={sponsor.id}
                                  src={sponsor.image_url || ""}
                                  alt={sponsor.name}
                                  title={sponsor.name}
                                  className="h-7 w-7 rounded-full object-cover ring-2 ring-background shadow-sm"
                                />
                              ))}
                            </div>
                          )}
                      </div>

                      {/* Single Winner */}
                      {winner ? (
                        <div className="text-sm mb-3">
                          <span className="text-muted-foreground">
                            Winner:{" "}
                          </span>
                          <span className="text-foreground font-medium">
                            @
                            {winner.submission.job?.owner_username ||
                              winner.submission.submitter_username ||
                              "unknown"}
                          </span>
                          {winner.submission.job && (
                            <span className="text-muted-foreground">
                              {" "}
                              • {winner.submission.job.slug}
                            </span>
                          )}
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {" "}
                            — {formatUsd(winner.prize_amount)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-3">
                          {formatPrize(totalPrize)}
                        </p>
                      )}

                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        View details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!loading && hackathons.length === 0 && (
          <div className="text-center py-16">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hackathons yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Check back soon for upcoming competitions!
            </p>
          </div>
        )}
      </main>
    </BaseLayout>
  );
}
