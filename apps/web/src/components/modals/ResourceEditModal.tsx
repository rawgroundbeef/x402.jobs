"use client";

import { useState, useRef, useCallback } from "react";
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
import { Loader2, Upload, Box, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { useToast } from "@x402jobs/ui/toast";

interface ResourceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    server_slug?: string;
    avatar_url?: string;
  };
  onSaved: (newSlug?: string) => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ResourceEditModal({
  isOpen,
  onClose,
  resource,
  onSaved,
}: ResourceEditModalProps) {
  const [slug, setSlug] = useState(resource.slug || "");
  const [name, setName] = useState(resource.name || "");
  const [description, setDescription] = useState(resource.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(
    resource.avatar_url || null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
    setImagePreview(resource.avatar_url || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [resource.avatar_url]);

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
        throw new Error("Failed to upload image to storage");
      }

      return publicUrl;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Upload image first if there's a new one
      let newImageUrl: string | null = null;
      if (imageFile) {
        newImageUrl = await uploadImage();
      }

      // Build updates object
      const updates: Record<string, string> = {};
      if (name !== resource.name) updates.name = name;
      if (description !== (resource.description || ""))
        updates.description = description;
      if (newImageUrl) updates.avatarUrl = newImageUrl;

      // Update details (name, description, image) if any changed
      if (Object.keys(updates).length > 0) {
        const res = await authenticatedFetch(`/resources/${resource.id}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update resource");
        }
      }

      // Update slug separately if changed
      if (slug !== resource.slug) {
        const slugRes = await authenticatedFetch(
          `/resources/${resource.id}/slug`,
          {
            method: "PATCH",
            body: JSON.stringify({ slug: slug.toLowerCase() }),
          },
        );

        if (!slugRes.ok) {
          const data = await slugRes.json();
          throw new Error(data.error || "Failed to update slug");
        }
      }

      toast({ title: "Resource updated", variant: "success" });
      onSaved(slug !== resource.slug ? slug : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    name !== resource.name ||
    slug !== resource.slug ||
    description !== (resource.description || "") ||
    imageFile !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Resource Image</Label>
            <div
              className={`relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="flex flex-col items-center gap-3">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Resource preview"
                      className="w-24 h-24 rounded-xl object-cover border border-border"
                    />
                    {imageFile && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage();
                        }}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center">
                    <Box className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm font-medium flex items-center justify-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    {imageFile ? "Change image" : "Click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or drag and drop • JPG, PNG, WebP • Max 2MB
                  </p>
                </div>
              </div>

              {isUploadingImage && (
                <div className="absolute inset-0 bg-background/80 rounded-xl flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Resource name"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              Display name for your resource
            </p>
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {resource.server_slug}/
              </span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="resource-slug"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier (lowercase, numbers, hyphens only)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this resource does..."
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/1000 characters
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
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
  );
}
