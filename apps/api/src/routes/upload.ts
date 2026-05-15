import { Router } from "express";
import type { Router as RouterType } from "express";
import { v4 as uuidv4 } from "uuid";
import { getSupabase } from "../lib/supabase";
import { httpClient, isBlockedRequestError } from "../lib/http-client";

export const uploadRouter: RouterType = Router();

const BUCKET_NAME = "generated-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Valid upload types for x402-jobs
type UploadType = "resource-input" | "job-avatar" | "user-avatar" | "general";

/**
 * Get file extension from filename or mime type
 */
function getFileExtension(fileName: string, mimeType: string): string {
  const fileExt = fileName.split(".").pop()?.toLowerCase();
  if (fileExt && ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt)) {
    return fileExt === "jpeg" ? "jpg" : fileExt;
  }

  switch (mimeType) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

/**
 * Generate a unique file path based on upload type
 */
function generateFilePath(
  uploadType: UploadType,
  fileName: string,
  fileType: string,
  userId?: string,
): string {
  const timestamp = Date.now();
  const uuid = uuidv4().substring(0, 8);
  const extension = getFileExtension(fileName, fileType);

  switch (uploadType) {
    case "resource-input":
      return `resource-inputs/${userId || "anonymous"}/${timestamp}_${uuid}.${extension}`;
    case "job-avatar":
      return `job-avatars/${userId || "anonymous"}/${timestamp}_${uuid}.${extension}`;
    case "user-avatar":
      return `user-avatars/${userId || "anonymous"}/${timestamp}_${uuid}.${extension}`;
    case "general":
    default:
      return `x402-uploads/${timestamp}_${uuid}.${extension}`;
  }
}

// POST /upload/signed-url - Generate signed URL for file upload
uploadRouter.post("/signed-url", async (req, res) => {
  try {
    // HIGH-04: userId is intentionally NOT read from req.body.
    // File ownership is bound to the authenticated user only. We accept and
    // silently ignore a `userId` field for backward compatibility with old
    // clients, but log a warning so legitimate callers can drop it.
    const { fileName, fileType, fileSize, uploadType } = req.body;
    if (Object.prototype.hasOwnProperty.call(req.body, "userId")) {
      console.warn(
        "[upload] ignored userId from body on /signed-url; using authenticated user",
      );
    }
    const authUserId = req.user!.id;

    // Validate required fields
    if (!fileName || !fileType || !fileSize || !uploadType) {
      return res.status(400).json({
        error:
          "Missing required fields: fileName, fileType, fileSize, uploadType",
      });
    }

    // Validate upload type
    const validUploadTypes: UploadType[] = [
      "resource-input",
      "job-avatar",
      "user-avatar",
      "general",
    ];
    if (!validUploadTypes.includes(uploadType)) {
      return res.status(400).json({
        error: `Invalid uploadType. Must be one of: ${validUploadTypes.join(", ")}`,
      });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(fileType)) {
      return res.status(400).json({
        error: "Invalid file type. Only JPG, PNG, WebP, and GIF are allowed.",
      });
    }

    // Validate file size
    const size = parseInt(fileSize);
    if (isNaN(size) || size > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: "File too large. Maximum size is 10MB.",
      });
    }

    const supabase = getSupabase();

    // Generate unique file path (bound to authenticated user, HIGH-04).
    const filePath = generateFilePath(
      uploadType as UploadType,
      fileName,
      fileType,
      authUserId,
    );

    console.log(`📝 [UPLOAD] Generating signed URL for: ${filePath}`);

    // Create signed URL for upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath, {
        upsert: false,
      });

    if (error) {
      console.error("❌ [UPLOAD] Error creating signed URL:", error);
      return res.status(500).json({
        error: `Failed to create upload URL: ${error.message}`,
      });
    }

    // Get the public URL for the file (for after upload)
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log(`✅ [UPLOAD] Generated signed URL for ${filePath}`);

    res.json({
      uploadUrl: data.signedUrl,
      publicUrl: publicUrlData.publicUrl,
      filePath,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error("❌ [UPLOAD] Error in POST /signed-url:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /upload/from-url - Download image from URL and save to bucket
uploadRouter.post("/from-url", async (req, res) => {
  try {
    // HIGH-04: userId is intentionally NOT read from req.body. See /signed-url.
    const { imageUrl, uploadType } = req.body;
    if (Object.prototype.hasOwnProperty.call(req.body, "userId")) {
      console.warn(
        "[upload] ignored userId from body on /from-url; using authenticated user",
      );
    }
    const authUserId = req.user!.id;

    // Validate required fields
    if (!imageUrl || !uploadType) {
      return res.status(400).json({
        error: "Missing required fields: imageUrl, uploadType",
      });
    }

    // Validate upload type
    const validUploadTypes: UploadType[] = [
      "resource-input",
      "job-avatar",
      "user-avatar",
      "general",
    ];
    if (!validUploadTypes.includes(uploadType)) {
      return res.status(400).json({
        error: `Invalid uploadType. Must be one of: ${validUploadTypes.join(", ")}`,
      });
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(imageUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(400).json({
        error: "Invalid URL format",
      });
    }

    console.log(`📥 [UPLOAD] Downloading image from URL: ${imageUrl}`);

    // Download the image (SSRF-safe: rejects private/loopback/link-local
    // targets at connect time via request-filtering-agent).
    let response;
    try {
      response = await httpClient.get<ArrayBuffer>(imageUrl, {
        headers: {
          "User-Agent": "x402-jobs/1.0",
        },
        responseType: "arraybuffer",
      });
    } catch (err) {
      if (isBlockedRequestError(err)) {
        const msg = (err as Error).message;
        console.warn(`[UPLOAD] SSRF blocked: ${msg}`);
        return res.status(400).json({ error: "URL not allowed" });
      }
      throw err;
    }

    if (response.status < 200 || response.status >= 300) {
      return res.status(400).json({
        error: `Failed to download image: ${response.status} ${response.statusText || ""}`.trim(),
      });
    }

    // Check content type. axios returns headers as a plain (lowercased-key)
    // object, not a Headers instance.
    const contentTypeHeader = response.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string" ? contentTypeHeader : "";
    const mimeType = (contentType.split(";")[0] || "").trim();

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: `Invalid image type: ${mimeType}. Only JPG, PNG, WebP, and GIF are allowed.`,
      });
    }

    // Get the image data. responseType=arraybuffer means response.data is
    // already a Buffer-like (Node) or ArrayBuffer; Buffer.from handles both.
    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: "Image too large. Maximum size is 10MB.",
      });
    }

    // Generate filename from URL or use generic name
    const urlPath = url.pathname;
    const originalName = urlPath.split("/").pop() || "image";
    const fileName = originalName.includes(".")
      ? originalName
      : `${originalName}.jpg`;

    // Generate file path (bound to authenticated user, HIGH-04).
    const filePath = generateFilePath(
      uploadType as UploadType,
      fileName,
      mimeType,
      authUserId,
    );

    console.log(`📤 [UPLOAD] Uploading to bucket: ${filePath}`);

    const supabase = getSupabase();

    // Upload to bucket
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ [UPLOAD] Error uploading to bucket:", uploadError);
      return res.status(500).json({
        error: `Failed to upload image: ${uploadError.message}`,
      });
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log(`✅ [UPLOAD] Image saved from URL: ${publicUrlData.publicUrl}`);

    res.json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      filePath,
      originalUrl: imageUrl,
    });
  } catch (error) {
    console.error("❌ [UPLOAD] Error in POST /from-url:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /upload/verify - Verify file upload (optional, for confirmation)
uploadRouter.post("/verify", async (req, res) => {
  try {
    const { filePath } = req.body;
    // HIGH-04 defense-in-depth: derive caller identity from auth only.
    const authUserId = req.user!.id;

    if (!filePath) {
      return res.status(400).json({
        error: "Missing required field: filePath",
      });
    }

    // Ownership scope: user-scoped buckets must include the authenticated
    // user's id in the path. The /general namespace has no user-scoped
    // segment (per generateFilePath) so it is exempt.
    if (
      typeof filePath === "string" &&
      /^(resource-inputs|job-avatars|user-avatars)\//.test(filePath) &&
      !filePath.split("/").includes(authUserId)
    ) {
      return res.status(403).json({
        error: "Forbidden: filePath does not belong to authenticated user",
      });
    }

    const supabase = getSupabase();

    // Extract directory and filename
    const parts = filePath.split("/");
    const fileName = parts.pop() || "";
    const directory = parts.join("/");

    // Check if file exists
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(directory, {
        search: fileName,
      });

    if (error) {
      console.error("❌ [UPLOAD] Error verifying upload:", error);
      return res.status(500).json({
        error: `Failed to verify upload: ${error.message}`,
      });
    }

    const file = data?.find((f) => f.name === fileName);

    if (!file) {
      return res.status(404).json({
        error: "File not found after upload",
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    console.log(`✅ [UPLOAD] Upload verified: ${fileName}`);

    res.json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      fileSize: file.metadata?.size || 0,
    });
  } catch (error) {
    console.error("❌ [UPLOAD] Error in POST /verify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
