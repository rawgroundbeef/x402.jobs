"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Textarea } from "@x402jobs/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Switch } from "@x402jobs/ui/switch";
import { Loader2, Zap, Eye, EyeOff } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface JobEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    avatar_url?: string;
    owner_username?: string;
    show_workflow?: boolean;
  };
  onSaved: (newSlug?: string) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function JobEditModal({
  isOpen,
  onClose,
  job,
  onSaved,
}: JobEditModalProps) {
  const [name, setName] = useState(job.name || "");
  const [slug, setSlug] = useState(job.slug || "");
  const [description, setDescription] = useState(job.description || "");
  const [showWorkflow, setShowWorkflow] = useState(job.show_workflow ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(
    job.avatar_url || null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [_isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when job changes
  useEffect(() => {
    setName(job.name || "");
    setSlug(job.slug || "");
    setDescription(job.description || "");
    setShowWorkflow(job.show_workflow ?? false);
    setImagePreview(job.avatar_url || null);
    setImageFile(null);
    setError(null);
  }, [job]);

  const handleImageSelect = useCallback((file: File) => {
    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be less than 2MB");
      return;
    }

    setError(null);
    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleImageSelect(file);
      }
    },
    [handleImageSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImageSelect(file);
      }
    },
    [handleImageSelect],
  );

  const removeImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(job.avatar_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [job.avatar_url]);

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setIsUploadingImage(true);
    try {
      // Step 1: Get signed upload URL
      const signedUrlRes = await authenticatedFetch("/upload/signed-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: imageFile.name,
          fileType: imageFile.type,
          fileSize: imageFile.size,
          uploadType: "general",
        }),
      });

      if (!signedUrlRes.ok) {
        const data = await signedUrlRes.json();
        throw new Error(data.error || "Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await signedUrlRes.json();

      // Step 2: Upload file directly to storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: imageFile,
        headers: {
          "Content-Type": imageFile.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image");
      }

      return publicUrl;
    } catch (err) {
      console.error("Image upload error:", err);
      throw err;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Build update payload
      const updates: Record<string, unknown> = {};

      // Check what changed
      if (name.trim() !== job.name) {
        updates.name = name.trim();
      }
      if (description.trim() !== (job.description || "")) {
        updates.description = description.trim();
      }
      if (showWorkflow !== (job.show_workflow ?? false)) {
        updates.showWorkflow = showWorkflow;
      }

      // Upload image if changed
      if (imageFile) {
        const imageUrl = await uploadImage();
        if (imageUrl) {
          updates.avatarUrl = imageUrl;
        }
      }

      // Update job details (name, description, avatar) via PUT endpoint
      if (Object.keys(updates).length > 0) {
        const res = await authenticatedFetch(`/jobs/${job.id}`, {
          method: "PUT",
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update job");
        }
      }

      // Update slug separately if changed
      let newSlug: string | undefined;
      if (slug.trim() !== job.slug) {
        const slugRes = await authenticatedFetch(`/jobs/${job.id}/slug`, {
          method: "PUT",
          body: JSON.stringify({ slug: slug.trim() }),
        });

        if (!slugRes.ok) {
          const data = await slugRes.json();
          throw new Error(
            data.error || data.message || "Failed to update slug",
          );
        }
        newSlug = slug.trim();
      }

      onSaved(newSlug);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    name.trim() !== job.name ||
    slug.trim() !== (job.slug || "") ||
    description.trim() !== (job.description || "") ||
    showWorkflow !== (job.show_workflow ?? false) ||
    imageFile !== null;

  // Generate the job URL preview
  const jobUrlPreview = job.owner_username
    ? `@${job.owner_username}/${slug || job.slug || "..."}`
    : `jobs/${job.id}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Job Image</Label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview}
                    alt="Job preview"
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {imageFile?.name || "Current image"}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-primary hover:underline"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-4"
                >
                  <div className="w-12 h-12 rounded-lg bg-accent border border-muted-foreground/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Click to upload
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      JPG, PNG, WebP (max 2MB)
                    </p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="job-name">Name</Label>
            <Input
              id="job-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Job"
            />
          </div>

          {/* Slug / URL */}
          <div className="space-y-2">
            <Label htmlFor="job-slug">URL Slug</Label>
            <Input
              id="job-slug"
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                )
              }
              placeholder="my-job"
            />
            <p className="text-xs text-muted-foreground">{jobUrlPreview}</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="job-description">Description</Label>
            <Textarea
              id="job-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this job do?"
              rows={3}
            />
          </div>

          {/* Show Workflow Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label
                htmlFor="show-workflow"
                className="flex items-center gap-2 cursor-pointer"
              >
                {showWorkflow ? (
                  <Eye className="h-4 w-4 text-emerald-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                Show workflow publicly
              </Label>
              <p className="text-xs text-muted-foreground">
                {showWorkflow
                  ? "Visitors can see the resources used in this job"
                  : "Workflow is hidden from public view"}
              </p>
            </div>
            <Switch
              id="show-workflow"
              checked={showWorkflow}
              onCheckedChange={setShowWorkflow}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
