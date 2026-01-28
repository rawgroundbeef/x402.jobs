"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@x402jobs/ui/button";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { Card } from "@x402jobs/ui/card";
import { Progress } from "@x402jobs/ui/progress";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { useToast } from "@x402jobs/ui/toast";
import { Image, AlertCircle, Loader2, User, Upload } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

interface AvatarCardProps {
  avatarUrl: string | undefined;
  onUpdate: () => void;
}

export default function AvatarCard({ avatarUrl, onUpdate }: AvatarCardProps) {
  const { toast } = useToast();
  const { uploadAvatar, isUploading, uploadProgress } = useAvatarUpload();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    setError("");
    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleUpdate = async () => {
    if (!selectedFile) {
      setError("Please select an image");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      // Upload the file
      const result = await uploadAvatar(selectedFile);

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      // Update profile with new avatar URL
      const res = await authenticatedFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ avatar_url: result.data?.publicUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update avatar");
      }

      toast({
        title: "Profile picture updated",
        variant: "success",
      });
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    setError("");

    try {
      const res = await authenticatedFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ avatar_url: null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove avatar");
      }

      toast({
        title: "Profile picture removed",
        variant: "success",
      });
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    setError("");
  };

  const isProcessing = isSaving || isUploading;

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Image className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Profile Picture</h2>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="h-12 w-12 rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Change Profile Picture</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Upload an image to use as your profile picture.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Drop zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
                ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                ${isProcessing ? "pointer-events-none opacity-50" : ""}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
                disabled={isProcessing}
              />

              <div className="flex flex-col items-center gap-3">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm font-medium">
                    {selectedFile
                      ? selectedFile.name
                      : "Drop an image here or click to browse"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP, or GIF • Max 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <div>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={isProcessing}
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={closeModal}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdate}
                disabled={isProcessing || !selectedFile}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
