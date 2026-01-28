"use client";

import { useState, useCallback } from "react";
import { authenticatedFetch } from "@/lib/api";

export interface AvatarUploadResult {
  success: boolean;
  data?: {
    publicUrl: string;
    filePath: string;
  };
  error?: string;
}

export function useAvatarUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadAvatar = useCallback(
    async (file: File, userId?: string): Promise<AvatarUploadResult> => {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          return {
            success: false,
            error: "Please select an image file",
          };
        }

        // Validate file size (max 5MB for avatars)
        if (file.size > 5 * 1024 * 1024) {
          return {
            success: false,
            error: "Image must be smaller than 5MB",
          };
        }

        // Step 1: Get signed URL for user avatar upload
        setUploadProgress(10);
        const signedUrlResponse = await authenticatedFetch(
          "/upload/signed-url",
          {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              uploadType: "user-avatar",
              userId,
            }),
          },
        );

        if (!signedUrlResponse.ok) {
          const errorData = await signedUrlResponse.json();
          throw new Error(errorData.error || "Failed to get upload URL");
        }

        const { uploadUrl, publicUrl, filePath } =
          await signedUrlResponse.json();

        setUploadProgress(30);

        // Step 2: Upload file directly to Supabase
        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(
            `Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`,
          );
        }

        setUploadProgress(100);

        return {
          success: true,
          data: {
            publicUrl,
            filePath,
          },
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error ? error.message : "Unknown upload error",
        };
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [],
  );

  return {
    uploadAvatar,
    isUploading,
    uploadProgress,
  };
}
