"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Textarea } from "@x402jobs/ui/textarea";
import { Badge } from "@x402jobs/ui/badge";
import { Alert } from "@x402jobs/ui/alert";
import { Dropdown, DropdownItem, DropdownDivider } from "@x402jobs/ui/dropdown";
import { ImageUrlOrUpload } from "@/components/inputs/ImageUrlOrUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRightLeft,
  Trash2,
  Loader2,
  Zap,
  Play,
  MoreVertical,
  Pencil,
  Calendar,
  Clock,
} from "lucide-react";
import { API_URL, authenticatedFetch } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { useTransferJobMutation } from "@/hooks/useTransferJobMutation";
import { useSaveJobMutation } from "@/hooks/useSaveJobMutation";
import { useUpdateJobSlugMutation } from "@/hooks/useUpdateJobSlugMutation";
import { useToast } from "@x402jobs/ui/toast";
import { cronToHuman } from "@/lib/schedule";

interface Job {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  network?: string;
  trigger_methods?: {
    webhook?: boolean;
    manual?: boolean;
    schedule?: boolean;
  };
  trigger_type?: string;
  schedule_cron?: string;
  schedule_enabled?: boolean;
  run_count?: number;
  total_earnings_usdc?: number;
  published?: boolean;
  created_at: string;
  updated_at: string;
}

interface JobCardProps {
  job: Job;
  onUpdate: () => void;
}

export default function JobCard({ job, onUpdate }: JobCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { transferJob } = useTransferJobMutation();
  const { saveJob } = useSaveJobMutation();
  const { updateSlug } = useUpdateJobSlugMutation();

  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState(job.name);
  const [editSlug, setEditSlug] = useState(job.slug || "");
  const [editDescription, setEditDescription] = useState(job.description || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(job.avatar_url || "");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Reset edit form when dialog opens
  useEffect(() => {
    if (showEditDialog) {
      setEditName(job.name);
      setEditSlug(job.slug || "");
      setEditDescription(job.description || "");
      setEditAvatarUrl(job.avatar_url || "");
      setEditError("");
    }
  }, [showEditDialog, job]);

  // Transfer ownership
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferError, setTransferError] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Delete
  const [isDeleting, setIsDeleting] = useState(false);

  const isPublic = job.published && job.trigger_methods?.webhook;
  const hasWebhook =
    job.trigger_methods?.webhook || job.trigger_type === "webhook";
  const hasManualTrigger = job.trigger_methods?.manual !== false; // Default to true
  const hasSchedule = job.trigger_methods?.schedule && job.schedule_cron;

  // Get username from user profile or fall back to email prefix
  const username =
    user?.user_metadata?.username ||
    user?.user_metadata?.preferred_username ||
    user?.email?.split("@")[0];

  const webhookUrl =
    username && job.slug
      ? `${API_URL}/@${username}/${job.slug}`
      : `${API_URL}/webhooks/${job.id}`;

  // Get human-readable schedule description
  const scheduleDescription = job.schedule_cron
    ? cronToHuman(job.schedule_cron)
    : null;

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
      variant: "success",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunNow = async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      const res = await authenticatedFetch(`/jobs/${job.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to run job");
      }

      toast({
        title: "Job started",
        description: `"${job.name}" is now running`,
        variant: "success",
      });

      // Refresh to update run count
      onUpdate();
    } catch (error) {
      toast({
        title: "Failed to run job",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSlugChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setEditSlug(sanitized);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }

    // Validate slug format if provided
    if (editSlug) {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(editSlug)) {
        setEditError(
          "Slug can only contain lowercase letters, numbers, and hyphens",
        );
        return;
      }
    }

    setEditLoading(true);
    setEditError("");

    try {
      // Save name, description, avatar
      await saveJob(job.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        avatarUrl: editAvatarUrl.trim() || undefined,
      });

      // Update slug if changed
      if (editSlug !== (job.slug || "")) {
        if (editSlug) {
          await updateSlug(job.id, editSlug);
        }
      }

      toast({
        title: "Job updated",
        description: "Your changes have been saved",
        variant: "success",
      });
      setShowEditDialog(false);
      onUpdate();
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferUsername.trim()) {
      setTransferError("Please enter a username");
      return;
    }

    setTransferLoading(true);
    setTransferError("");

    try {
      await transferJob(job.id, transferUsername);
      setShowTransferDialog(false);
      setTransferUsername("");
      toast({
        title: "Job transferred",
        description: `"${job.name}" has been transferred to @${transferUsername}`,
        variant: "success",
      });
      onUpdate();
    } catch (error) {
      setTransferError(
        error instanceof Error ? error.message : "Failed to transfer job",
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${job.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(`/jobs/${job.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete job");
      }
      toast({
        title: "Job deleted",
        description: `"${job.name}" has been deleted`,
        variant: "success",
      });
      onUpdate();
    } catch (error) {
      toast({
        title: "Failed to delete job",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine run button state and tooltip
  const getRunButtonState = () => {
    if (isRunning) {
      return { disabled: false, tooltip: "Running..." };
    }
    if (!hasManualTrigger && !hasWebhook) {
      return {
        disabled: true,
        tooltip: "Add a trigger in Canvas to run this job",
      };
    }
    return { disabled: false, tooltip: "Run Now" };
  };

  const runButtonState = getRunButtonState();

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          {/* Left side - Avatar + Name + Badges */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {job.avatar_url ? (
              <img
                src={job.avatar_url}
                alt=""
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-medium truncate hover:underline hover:text-primary transition-colors"
                >
                  {job.name}
                </Link>
                {job.network && (
                  <ChainIcon
                    network={job.network as "solana" | "base"}
                    className="w-4 h-4 shrink-0"
                  />
                )}
                {isPublic && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-xs shrink-0">
                    Public
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {job.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {job.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Schedule + Stats + Actions */}
          <div className="flex items-center gap-4 shrink-0 ml-4">
            {/* Schedule Indicator */}
            {hasSchedule && scheduleDescription && (
              <button
                onClick={() => {
                  // TODO: Open schedule modal
                  window.location.href = `/jobs/${job.id}`;
                }}
                className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Click to edit schedule"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{scheduleDescription}</span>
              </button>
            )}

            {/* Runs */}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">
                {(job.run_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">runs</p>
            </div>

            {/* Earnings */}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-green-500">
                {formatUsd(job.total_earnings_usdc || 0)}
              </p>
              <p className="text-xs text-muted-foreground">earned</p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Run Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRunNow}
                disabled={runButtonState.disabled || isRunning}
                title={runButtonState.tooltip}
                className="text-trigger hover:text-trigger-dark hover:bg-trigger/10 disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              {/* Overflow Menu */}
              <Dropdown
                trigger={
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                }
                placement="bottom-end"
              >
                <DropdownItem asChild>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Canvas
                  </Link>
                </DropdownItem>
                <DropdownItem
                  onClick={handleRunNow}
                  disabled={runButtonState.disabled || isRunning}
                >
                  <span className="flex items-center gap-2">
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isRunning ? "Running..." : "Run Now"}
                  </span>
                </DropdownItem>
                <DropdownItem asChild>
                  <Link
                    href={`/jobs/${job.id}?panel=trigger`}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </Link>
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem onClick={() => setShowEditDialog(true)}>
                  <span className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Details
                  </span>
                </DropdownItem>
                {hasWebhook && (
                  <DropdownItem onClick={copyWebhookUrl}>
                    <span className="flex items-center gap-2">
                      {copied ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied!" : "Copy Webhook URL"}
                    </span>
                  </DropdownItem>
                )}
                {isPublic && username && job.slug && (
                  <DropdownItem asChild>
                    <Link
                      href={`/@${username}/${job.slug}`}
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Public Page
                    </Link>
                  </DropdownItem>
                )}
                <DropdownDivider />
                <DropdownItem onClick={() => setShowTransferDialog(true)}>
                  <span className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Transfer
                  </span>
                </DropdownItem>
                <DropdownItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-destructive"
                >
                  <span className="flex items-center gap-2">
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </span>
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>
              Update your job&apos;s name, description, and other details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="My Job"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">URL Slug</Label>
              <Input
                id="edit-slug"
                value={editSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-job"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Used in your webhook URL: @{username}/{editSlug || "..."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What does this job do?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Avatar</Label>
              <ImageUrlOrUpload
                value={editAvatarUrl}
                onChange={setEditAvatarUrl}
                placeholder="https://example.com/image.png"
              />
            </div>

            {editError && <Alert variant="destructive">{editError}</Alert>}

            <div className="pt-2 border-t border-border">
              <Link
                href={`/jobs/${job.id}`}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
                onClick={() => setShowEditDialog(false)}
              >
                Want to edit the workflow? Open in Canvas →
              </Link>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowEditDialog(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEditSave}
              disabled={editLoading || !editName.trim()}
            >
              {editLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Job Ownership</DialogTitle>
            <DialogDescription>
              Transfer &quot;{job.name}&quot; to another user. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-username">Recipient Username</Label>
              <Input
                id="transfer-username"
                value={transferUsername}
                onChange={(e) => setTransferUsername(e.target.value)}
                placeholder="Enter username"
              />
              <p className="text-xs text-muted-foreground">
                The new owner will have full control. Webhook URL will change.
              </p>
            </div>

            {transferError && (
              <Alert variant="destructive">{transferError}</Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowTransferDialog(false);
                setTransferUsername("");
                setTransferError("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleTransfer}
              disabled={transferLoading || !transferUsername.trim()}
            >
              {transferLoading ? "Transferring..." : "Transfer Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
