"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@x402jobs/ui/input";
import {
  Upload,
  Link,
  X,
  Image as ImageIcon,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import { useResourceImageUpload } from "@/hooks/useResourceImageUpload";
import { useAuth } from "@/contexts/AuthContext";

interface ImageUrlOrUploadProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hasError?: boolean;
  disabled?: boolean;
}

type InputMode = "url" | "upload";

// Check if URL is from our bucket (already saved)
function isOurBucketUrl(url: string): boolean {
  return (
    url.includes("supabase.co/storage") || url.includes("/generated-images/")
  );
}

export function ImageUrlOrUpload({
  value,
  onChange,
  placeholder = "Enter image URL...",
  className,
  hasError,
  disabled,
}: ImageUrlOrUploadProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<InputMode>("url");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value); // Local input state
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, uploadImageFromUrl, isUploading, uploadProgress } =
    useResourceImageUpload();

  // Sync local input with value prop
  useEffect(() => {
    setUrlInput(value);
    setIsSaved(isOurBucketUrl(value));
  }, [value]);

  // Handle saving URL to bucket
  const handleSaveUrl = useCallback(async () => {
    if (!urlInput.trim() || isUploading) return;

    // Skip if already saved to our bucket
    if (isOurBucketUrl(urlInput)) {
      setIsSaved(true);
      return;
    }

    // Validate URL format
    try {
      const url = new URL(urlInput);
      if (!["http:", "https:"].includes(url.protocol)) {
        setUploadError("Invalid URL protocol");
        return;
      }
    } catch {
      setUploadError("Invalid URL format");
      return;
    }

    setUploadError(null);

    const result = await uploadImageFromUrl(urlInput, user?.id);

    if (result.success && result.data) {
      onChange(result.data.publicUrl);
      setUrlInput(result.data.publicUrl);
      setIsSaved(true);
    } else {
      setUploadError(result.error || "Failed to save image");
    }
  }, [urlInput, uploadImageFromUrl, onChange, user?.id, isUploading]);

  const handleModeSwitch = (newMode: InputMode) => {
    setMode(newMode);
    setUploadError(null);
    // Don't clear the value when switching modes so user doesn't lose their input
  };

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadError(null);

      // Create local preview immediately
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload the file
      const result = await uploadImage(file, user?.id);

      if (result.success && result.data) {
        onChange(result.data.publicUrl);
        setPreviewUrl(null); // Clear preview, real URL is now set
      } else {
        setUploadError(result.error || "Upload failed");
        setPreviewUrl(null);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [uploadImage, onChange, user?.id],
  );

  const handleClearImage = () => {
    onChange("");
    setUrlInput("");
    setPreviewUrl(null);
    setUploadError(null);
    setIsSaved(false);
  };

  const displayUrl = previewUrl || value;
  const showPreview = displayUrl && displayUrl.startsWith("http");

  return (
    <div className={cn("space-y-2", className)}>
      {/* Mode Toggle */}
      <div className="flex gap-1 p-0.5 bg-muted rounded-md w-fit">
        <button
          type="button"
          onClick={() => handleModeSwitch("url")}
          disabled={disabled || isUploading}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors",
            mode === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Link className="h-3 w-3" />
          URL
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch("upload")}
          disabled={disabled || isUploading}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors",
            mode === "upload"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Upload className="h-3 w-3" />
          Upload
        </button>
      </div>

      {/* URL Input Mode */}
      {mode === "url" && (
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder={placeholder}
            value={urlInput}
            onChange={(e) => {
              const newValue = e.target.value;
              setUrlInput(newValue);
              setIsSaved(false);
              setUploadError(null);
              // Sync to parent so form always has current value
              // (even if bucket upload hasn't completed yet)
              onChange(newValue);
            }}
            onBlur={() => {
              // Auto-save on blur if URL looks valid and isn't saved yet
              if (
                urlInput &&
                urlInput.startsWith("http") &&
                !isOurBucketUrl(urlInput)
              ) {
                handleSaveUrl();
              }
            }}
            className={cn(hasError ? "border-destructive" : "", "flex-1")}
            disabled={disabled || isUploading}
          />
          {urlInput && !isOurBucketUrl(urlInput) && (
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={disabled || isUploading || !urlInput.trim()}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5",
                isUploading
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {uploadProgress}%
                </>
              ) : (
                "Save"
              )}
            </button>
          )}
          {isSaved && urlInput && (
            <div className="flex items-center gap-1 px-2 text-sm text-primary">
              <Check className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>
      )}

      {/* Upload Mode */}
      {mode === "upload" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />

          {/* Show upload button or preview */}
          {!showPreview && !isUploading ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg transition-colors",
                hasError
                  ? "border-destructive"
                  : "border-input hover:border-primary/50 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-sm text-muted-foreground">
                Click to upload image
              </span>
              <span className="text-xs text-muted-foreground/70 mt-0.5">
                JPG, PNG, WebP, GIF (max 10MB)
              </span>
            </button>
          ) : isUploading ? (
            <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-input rounded-lg bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-1" />
              <span className="text-sm text-muted-foreground">
                Uploading... {uploadProgress}%
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Image Preview (shown in both modes when we have a valid URL) */}
      {showPreview && !isUploading && (
        <div className="relative group">
          <div className="relative rounded-lg overflow-hidden border border-input bg-muted/30">
            <img
              src={displayUrl}
              alt="Preview"
              className="w-full h-32 object-contain"
              onError={() => {
                // If URL mode and image fails to load, it's not a valid image URL
                if (mode === "url") {
                  // Keep the URL, just don't show preview
                  setPreviewUrl(null);
                }
              }}
            />
            <button
              type="button"
              onClick={handleClearImage}
              disabled={disabled}
              className="absolute top-2 right-2 p-1 bg-background/80 hover:bg-background rounded-full transition-colors shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}
