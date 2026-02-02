"use client";

import { useState, useRef, useCallback } from "react";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import { useResourceImageUpload } from "@/hooks/useResourceImageUpload";
import { useAuth } from "@/contexts/AuthContext";

interface ImageDropZoneProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ImageDropZone({ value, onChange, className }: ImageDropZoneProps) {
  const { user } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading, uploadProgress } = useResourceImageUpload();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setUploadError(null);

      // Instant local preview
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);

      const result = await uploadImage(file, user?.id);
      if (result.success && result.data) {
        onChange(result.data.publicUrl);
        setPreviewUrl(null);
      } else {
        setUploadError(result.error || "Upload failed");
        setPreviewUrl(null);
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadImage, onChange, user?.id],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleRemove = () => {
    onChange("");
    setPreviewUrl(null);
    setUploadError(null);
  };

  const displayUrl = previewUrl || value;
  const hasImage = displayUrl && displayUrl.startsWith("http");

  return (
    <div className={cn("flex flex-col items-center w-[150px]", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* With image */}
      {hasImage && !isUploading ? (
        <>
          <div className="relative w-[150px] h-[150px] rounded-[20px] border-2 border-border overflow-hidden group">
            <img
              src={displayUrl}
              alt="Resource"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Change
          </button>
        </>
      ) : isUploading ? (
        /* Uploading */
        <div className="w-[150px] h-[150px] rounded-[20px] border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin mb-1" />
          <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
        </div>
      ) : (
        /* Empty drop zone */
        <>
          <div
            className={cn(
              "w-[150px] h-[150px] rounded-[20px] border-2 border-dashed bg-muted/20 flex flex-col items-center justify-center cursor-pointer transition-all",
              dragOver
                ? "border-primary border-solid bg-primary/[0.08]"
                : "border-border hover:border-primary hover:bg-primary/[0.04]",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
            <ImageIcon className={cn(
              "w-7 h-7 mb-1.5 transition-colors",
              dragOver ? "text-primary" : "text-muted-foreground",
            )} />
            <span className="text-xs text-muted-foreground text-center leading-tight">
              Drop image<br />or click
            </span>
          </div>
          {uploadError && (
            <p className="mt-1 text-xs text-destructive text-center">{uploadError}</p>
          )}
        </>
      )}
    </div>
  );
}
