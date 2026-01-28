"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { Select } from "@x402jobs/ui/select";
import { Progress } from "@x402jobs/ui/progress";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import BaseLayout from "@/components/BaseLayout";
import { formatUsd } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";
import {
  formatCountdown,
  getProgressPercentage,
  formatPrize,
} from "@/lib/hackathon-utils";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Check,
  AlertCircle,
  Zap,
  ExternalLink,
  X,
} from "lucide-react";

interface SubmissionFormData {
  jobId: string;
  xPostUrl: string;
}

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
  rules: string | null;
  judging_criteria: string | null;
  prize: number; // Single winner-take-all prize
  prizes?: { first: number; second: number; third: number }; // Legacy
  starts_at: string;
  ends_at: string;
  resolved_at: string | null;
  status: "upcoming" | "active" | "judging" | "complete";
  sponsors?: Sponsor[];
}

interface Submission {
  id: string;
  hackathon_id: string;
  user_id: string;
  job_id: string;
  x_post_url: string | null;
  submitted_at: string;
  submitter_username?: string;
  job?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    avatar_url: string | null;
    run_count: number;
    total_earnings_usdc: string;
    owner_username: string;
  };
}

interface Job {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  trigger_methods?: { webhook?: boolean };
}

interface Winner {
  place: number; // Default 1 for winner-take-all
  prize_amount: number;
  submission: Submission;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.x402.jobs";

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatSubmittedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Winner-take-all means just one winner

interface HackathonDetailPageProps {
  slug: string;
}

export default function HackathonDetailPage({
  slug,
}: HackathonDetailPageProps) {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User's submission
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Submission form with react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SubmissionFormData>({
    defaultValues: {
      jobId: "",
      xPostUrl: "",
    },
  });

  const selectedJobId = watch("jobId");

  // Admin winner selection
  const [selectingWinner, setSelectingWinner] = useState<Submission | null>(
    null,
  );
  const [awardingWinner, setAwardingWinner] = useState(false);

  // User's public jobs
  const { data: jobsData } = useSWR<{ jobs: Job[] }>(
    isAuthenticated ? "/jobs" : null,
    authenticatedFetcher,
  );

  const publicJobs = (jobsData?.jobs || []).filter(
    (job) => job.published && job.trigger_methods?.webhook,
  );

  // Fetch hackathon details (with auth for admin status)
  useEffect(() => {
    async function fetchHackathon() {
      try {
        // Try authenticated fetch first to get admin status
        let res: Response;
        if (isAuthenticated) {
          res = await authenticatedFetch(`/hackathons/${slug}`);
        } else {
          res = await fetch(`${API_BASE}/hackathons/${slug}`);
        }

        if (!res.ok) {
          if (res.status === 404) {
            setError("Hackathon not found");
          } else {
            setError("Failed to load hackathon");
          }
          return;
        }
        const data = await res.json();
        setHackathon(data.hackathon);
        setSubmissions(data.submissions || []);
        setWinners(data.winners || []);
        setIsAdmin(data.isAdmin || false);
      } catch (e) {
        console.error("Failed to fetch hackathon:", e);
        setError("Failed to load hackathon");
      } finally {
        setLoading(false);
      }
    }
    fetchHackathon();
  }, [slug, isAuthenticated]);

  // Fetch user's submission
  useEffect(() => {
    if (!isAuthenticated || !hackathon) return;

    async function fetchMySubmission() {
      try {
        const res = await authenticatedFetch(
          `/hackathons/${slug}/my-submission`,
        );
        if (res.ok) {
          const data = await res.json();
          setMySubmission(data.submission);
          if (data.submission) {
            reset({
              jobId: data.submission.job_id || "",
              xPostUrl: data.submission.x_post_url || "",
            });
          }
        }
      } catch (e) {
        console.error("Failed to fetch submission:", e);
      }
    }
    fetchMySubmission();
  }, [isAuthenticated, hackathon, slug, reset]);

  const onSubmit = async (formData: SubmissionFormData) => {
    setSubmitting(true);

    try {
      const res = await authenticatedFetch(`/hackathons/${slug}/submit`, {
        method: "POST",
        body: JSON.stringify({
          jobId: formData.jobId,
          xPostUrl: formData.xPostUrl.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      const data = await res.json();
      setMySubmission(data.submission);

      // Refresh submissions list
      const refreshRes = await fetch(`${API_BASE}/hackathons/${slug}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setSubmissions(refreshData.submissions || []);
      }
    } catch (e) {
      // Form errors are handled inline via react-hook-form
      console.error("Submit error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw your submission?")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await authenticatedFetch(`/hackathons/${slug}/submit`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to withdraw");
      }

      setMySubmission(null);
      reset({
        jobId: "",
        xPostUrl: "",
      });

      // Refresh submissions list
      const refreshRes = await fetch(`${API_BASE}/hackathons/${slug}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setSubmissions(refreshData.submissions || []);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to withdraw");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAwardWinner = async () => {
    if (!selectingWinner) return;

    setAwardingWinner(true);
    try {
      const res = await authenticatedFetch(`/hackathons/${slug}/winner`, {
        method: "POST",
        body: JSON.stringify({ submissionId: selectingWinner.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to select winner");
      }

      // Refresh page data
      const refreshRes = await authenticatedFetch(`/hackathons/${slug}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setHackathon(refreshData.hackathon);
        setSubmissions(refreshData.submissions || []);
        setWinners(refreshData.winners || []);
      }

      setSelectingWinner(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to select winner");
    } finally {
      setAwardingWinner(false);
    }
  };

  if (loading) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </BaseLayout>
    );
  }

  if (error || !hackathon) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="text-center py-20">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {error || "Hackathon not found"}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/hackathons">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hackathons
            </Link>
          </Button>
        </div>
      </BaseLayout>
    );
  }

  // Check both status AND end date - hackathon might have ended but status not updated yet
  // If ends_at is null, there's no deadline so it hasn't ended
  const hasEnded = hackathon.ends_at
    ? new Date() > new Date(hackathon.ends_at)
    : false;
  const isActive = hackathon.status === "active" && !hasEnded;
  const isJudging =
    hackathon.status === "judging" ||
    (hackathon.status === "active" && hasEnded);
  const isComplete = hackathon.status === "complete";
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

  // Get the winner (single winner-take-all)
  const winner = winners.length > 0 ? winners[0] : null;

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <main className="pb-16">
        {/* Back link */}
        <Link
          href="/hackathons"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Hackathons
        </Link>

        {/* Hero */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            {hackathon.number
              ? `Hackathon #${hackathon.number}`
              : hackathon.name}
          </h1>

          {/* Prize */}
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
            {formatPrize(totalPrize)}
            <span className="text-lg font-normal text-muted-foreground ml-2">
              prize
            </span>
          </p>
          {/* Time remaining */}
          {isActive && hackathon.ends_at && (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-4">
              {timeText}
            </p>
          )}
          {!hackathon.ends_at && isActive && (
            <p className="text-sm text-muted-foreground mb-4">No deadline</p>
          )}

          {/* Sponsors */}
          {hackathon.sponsors && hackathon.sponsors.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Sponsored by
              </p>
              <div className="bg-muted/50 rounded-lg p-4 flex flex-wrap items-center gap-6">
                {hackathon.sponsors.map((sponsor) => (
                  <div
                    key={sponsor.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    {sponsor.image_url && (
                      <img
                        src={sponsor.image_url}
                        alt={sponsor.name}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-background shadow-md"
                      />
                    )}
                    <div className="flex flex-col">
                      {sponsor.display_name && sponsor.representative_x_url ? (
                        <>
                          <a
                            href={sponsor.representative_x_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            @{sponsor.display_name}
                          </a>
                          <a
                            href={sponsor.x_url || sponsor.website || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {sponsor.name}
                          </a>
                        </>
                      ) : (
                        <a
                          href={sponsor.x_url || sponsor.website || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {sponsor.name}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar - only show if there's a deadline */}
          {isActive && hackathon.ends_at && (
            <div className="mb-2 max-w-xl">
              <Progress
                value={progress}
                max={100}
                variant="gradient"
                className="h-2"
              />
            </div>
          )}

          {/* Timeline */}
          {isActive && hackathon.ends_at && (
            <p className="text-sm text-muted-foreground">
              Deadline: {formatDeadline(hackathon.ends_at)}
            </p>
          )}

          {isJudging && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
              ⏳ Submissions closed — Judging in progress
            </p>
          )}

          {isComplete && (
            <p className="text-sm text-muted-foreground">
              <Calendar className="inline h-4 w-4 mr-1" />
              Ended {formatDeadline(hackathon.ends_at)}
            </p>
          )}
        </section>

        {/* Winner (if complete) - Single winner-take-all */}
        {isComplete && winner && (
          <section className="py-8 border-t border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              🏆 Winner
            </h2>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="h-5 w-5 text-amber-500" />
                {winner.submission.job ? (
                  <Link
                    href={`/@${winner.submission.job.owner_username}/${winner.submission.job.slug}`}
                    className="font-bold hover:underline"
                  >
                    @{winner.submission.job.owner_username}/
                    {winner.submission.job.slug}
                  </Link>
                ) : (
                  <span className="font-bold">
                    @{winner.submission.submitter_username || "unknown"}
                  </span>
                )}
              </div>
              {winner.submission.job?.description && (
                <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                  {winner.submission.job.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
                {winner.submission.x_post_url && (
                  <a
                    href={winner.submission.x_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View Video
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <p className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Won {formatUsd(winner.prize_amount)} USDC
              </p>
            </Card>
          </section>
        )}

        {/* About - shown before submission form so users know the rules first */}
        <section className="py-8 border-t border-border">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            About
          </h2>
          {hackathon.description && (
            <p className="text-muted-foreground mb-4 max-w-2xl">
              {hackathon.description}
            </p>
          )}
          {hackathon.rules && (
            <div className="mb-4">
              <p className="text-sm font-medium text-foreground mb-2">Rules:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {hackathon.rules.split("\n").map((rule, i) => (
                  <li key={i}>
                    {rule.includes("x402scan") ? (
                      <>
                        {rule.split("x402scan")[0]}
                        <a
                          href="https://x402scan.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          x402scan
                        </a>
                        {rule.split("x402scan")[1]}
                      </>
                    ) : (
                      rule
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hackathon.judging_criteria && (
            <div className="mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Judged on
              </p>
              <div className="flex flex-wrap gap-2">
                {hackathon.judging_criteria
                  .split(/\s*[•·]\s*/)
                  .filter(Boolean)
                  .map((criteria) => (
                    <span
                      key={criteria}
                      className="px-3 py-1 bg-muted rounded-full text-sm text-foreground"
                    >
                      {criteria.trim()}
                    </span>
                  ))}
              </div>
            </div>
          )}
          {/* Help links */}
          <p className="text-sm text-muted-foreground">
            Need help? Check the{" "}
            <Link
              href="/docs/developer"
              className="text-primary hover:underline"
            >
              Developer Docs
            </Link>{" "}
            or ask in{" "}
            <a
              href="https://discord.gg/BUcC28x6BX"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Discord
            </a>
            .
          </p>

          {/* Sponsor/Mentor CTA */}
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Want to sponsor or mentor?
              </span>{" "}
              Reach out in{" "}
              <a
                href="https://discord.gg/BUcC28x6BX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Discord
              </a>{" "}
              to get involved.
            </p>
          </div>
        </section>

        {/* Submission Form (active hackathon only) */}
        {isActive && (
          <section className="py-8 border-t border-border">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              Your Submission
            </h2>

            {!isAuthenticated ? (
              <div className="max-w-md">
                <p className="text-muted-foreground mb-4">
                  Sign in to submit your entry
                </p>
                <Button asChild variant="primary">
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            ) : mySubmission ? (
              <div className="max-w-lg">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Submitted!</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Job:</p>
                    <Link
                      href={`/@${mySubmission.job?.owner_username}/${mySubmission.job?.slug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {mySubmission.job?.name || "Unknown job"}
                    </Link>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Video Demo:
                    </p>
                    <a
                      href={mySubmission.x_post_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {mySubmission.x_post_url || "Not set"}
                    </a>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Submitted on {formatSubmittedDate(mySubmission.submitted_at)}
                </p>
                {submitError && (
                  <p className="text-sm text-destructive mb-4">{submitError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setMySubmission(null)}
                  >
                    Change Submission
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleWithdraw}
                    disabled={submitting}
                    className="text-destructive hover:text-destructive"
                  >
                    Withdraw
                  </Button>
                </div>
              </div>
            ) : publicJobs.length === 0 ? (
              <div className="max-w-md">
                <p className="text-muted-foreground mb-4">
                  You need a public job with webhook trigger to submit.
                </p>
                <Button asChild variant="primary">
                  <Link href="/jobs/new">Create a Job</Link>
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="max-w-lg space-y-4"
              >
                <div>
                  <Label htmlFor="jobId">
                    Select Job <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedJobId}
                    onChange={(value) => setValue("jobId", value)}
                    options={[
                      { value: "", label: "Select a job..." },
                      ...publicJobs.map((job) => ({
                        value: job.id,
                        label: job.name,
                      })),
                    ]}
                    className="mt-1"
                  />
                  {errors.jobId && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.jobId.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="xPostUrl">
                    X Post with Video Demo{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="xPostUrl"
                    type="url"
                    placeholder="https://x.com/username/status/..."
                    className="mt-1"
                    {...register("xPostUrl", {
                      required: "X post URL is required",
                      pattern: {
                        value: /^https:\/\/(x\.com|twitter\.com)\//,
                        message: "URL must be from x.com or twitter.com",
                      },
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Post a video demo of your job on X and paste the link
                  </p>
                  {errors.xPostUrl && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.xPostUrl.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={submitting} variant="primary">
                  {submitting ? "Submitting..." : "Submit Entry"}
                </Button>
              </form>
            )}
          </section>
        )}

        {/* All Submissions */}
        <section className="py-8 border-t border-border">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            {isComplete && winner ? "Other Submissions" : "Submissions"} (
            {
              submissions.filter(
                (s) => !winner || s.id !== winner.submission?.id,
              ).length
            }
            )
          </h2>

          {submissions.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="h-12 w-12 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No submissions yet</p>
              {isActive && (
                <p className="text-sm text-muted-foreground mt-2">
                  Be the first to submit!
                </p>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {submissions
                .filter((s) => !winner || s.id !== winner.submission?.id)
                .map((submission) => (
                  <Card key={submission.id} className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Job info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {submission.job ? (
                            <Link
                              href={`/@${submission.job.owner_username}/${submission.job.slug}`}
                              className="font-medium hover:underline"
                            >
                              @{submission.job.owner_username}/
                              {submission.job.slug}
                            </Link>
                          ) : (
                            <div className="font-medium">
                              @{submission.submitter_username || "unknown"}
                            </div>
                          )}
                          {submission.job?.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {submission.job.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Submitted{" "}
                            {formatSubmittedDate(submission.submitted_at)}
                          </p>
                        </div>
                      </div>

                      {/* Links */}
                      {submission.x_post_url && (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <a
                            href={submission.x_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View Video
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}

                      {/* Admin: Select as Winner button */}
                      {isAdmin && isActive && !winner && (
                        <div className="flex justify-end pt-2 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectingWinner(submission)}
                            className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10"
                          >
                            Select as Winner 🏆
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </section>

        {/* Winner Selection Confirmation Dialog */}
        {selectingWinner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <Card className="w-full max-w-md p-6 m-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Select Winner
                </h3>
                <button
                  onClick={() => setSelectingWinner(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Award{" "}
                  <span className="text-emerald-500 font-semibold">
                    {formatUsd(totalPrize)} USDC
                  </span>{" "}
                  to:
                </p>
                <p className="font-medium">
                  @{selectingWinner.submitter_username || "unknown"}
                </p>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>This will:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Mark this submission as the winner</li>
                    <li>Close the hackathon</li>
                    <li>Notify the winner</li>
                  </ul>
                </div>

                <p className="text-sm text-amber-600 font-medium">
                  This cannot be undone.
                </p>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectingWinner(null)}
                    className="flex-1"
                    disabled={awardingWinner}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleAwardWinner}
                    className="flex-1"
                    disabled={awardingWinner}
                  >
                    {awardingWinner ? "Awarding..." : "Confirm & Award"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </BaseLayout>
  );
}
