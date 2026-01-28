"use client";

import { useState, useCallback } from "react";
import { authenticatedFetch } from "@/lib/api";

export interface ResourceImageUploadResult {
  success: boolean;
  data?: {
    publicUrl: string;
    filePath: string;
  };
  error?: string;
}

export function useResourceImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImageFromUrl = useCallback(
    async (
      imageUrl: string,
      userId?: string,
    ): Promise<ResourceImageUploadResult> => {
      setIsUploading(true);
      setUploadProgress(0);

      try {
        // Validate URL format
        try {
          const url = new URL(imageUrl);
          if (!["http:", "https:"].includes(url.protocol)) {
            throw new Error("Invalid protocol");
          }
        } catch {
          return {
            success: false,
            error: "Invalid URL format",
          };
        }

        setUploadProgress(20);

        // Call backend to download and save
        const response = await authenticatedFetch("/upload/from-url", {
          method: "POST",
          body: JSON.stringify({
            imageUrl,
            uploadType: "resource-input",
            userId,
          }),
        });

        setUploadProgress(80);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save image");
        }

        const data = await response.json();
        setUploadProgress(100);

        return {
          success: true,
          data: {
            publicUrl: data.publicUrl,
            filePath: data.filePath,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [],
  );

  const uploadImage = useCallback(
    async (file: File, userId?: string): Promise<ResourceImageUploadResult> => {
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

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return {
            success: false,
            error: "Image must be smaller than 10MB",
          };
        }

        // Step 1: Get signed URL for resource input upload
        setUploadProgress(10);
        const signedUrlResponse = await authenticatedFetch(
          "/upload/signed-url",
          {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              uploadType: "resource-input",
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
    uploadImage,
    uploadImageFromUrl,
    isUploading,
    uploadProgress,
  };
}
