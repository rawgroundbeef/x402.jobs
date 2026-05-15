import { Router } from "express";
import type { Router as RouterType } from "express";
import crypto from "crypto";
import { getSupabase } from "../lib/supabase";
import { httpClient, isBlockedRequestError } from "../lib/http-client";

export const imagesRouter: RouterType = Router();

const BUCKET_NAME = "x402-cached-images";

// Helper to get file extension from content type
function getExtFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[contentType] || "png";
}

// Helper to generate a hash from URL
function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").substring(0, 16);
}

// POST /api/images/cache - Cache an external image
imagesRouter.post("/cache", async (req, res) => {
  try {
    const { url, type } = req.body; // type: "avatar" | "favicon"

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const supabase = getSupabase();

    // Generate a unique filename based on URL hash
    const urlHash = hashUrl(url);
    const prefix = type === "favicon" ? "favicons" : "avatars";

    // Check if we already have this cached
    const { data: existing } = await supabase
      .from("x402_cached_images")
      .select("cached_url")
      .eq("original_url", url)
      .maybeSingle();

    if (existing?.cached_url) {
      return res.json({
        cachedUrl: existing.cached_url,
        cached: true,
        source: "database",
      });
    }

    // Download the image (SSRF-safe at connect time via request-filtering-agent).
    let response;
    try {
      response = await httpClient.get<ArrayBuffer>(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; X402Bot/1.0)",
        },
        responseType: "arraybuffer",
      });
    } catch (fetchError) {
      if (isBlockedRequestError(fetchError)) {
        const msg = (fetchError as Error).message;
        console.warn(`[Images] SSRF blocked: ${msg}`);
        return res.status(400).json({ error: "URL not allowed" });
      }
      console.error("Failed to fetch image:", fetchError);
      return res.status(400).json({ error: "Failed to fetch image from URL" });
    }

    if (response.status < 200 || response.status >= 300) {
      return res.status(400).json({
        error: "Failed to fetch image",
        status: response.status,
      });
    }

    const contentTypeHeader = response.headers["content-type"];
    const contentType =
      typeof contentTypeHeader === "string" ? contentTypeHeader : "image/png";
    const ext = getExtFromContentType(contentType);
    const filename = `${prefix}/${urlHash}.${ext}`;

    // Get the image as buffer. responseType=arraybuffer puts the bytes in
    // response.data already; Buffer.from handles both Buffer and ArrayBuffer.
    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return res.status(500).json({ error: "Failed to cache image" });
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    const cachedUrl = publicUrlData.publicUrl;

    // Store in database for quick lookup
    await supabase.from("x402_cached_images").upsert(
      {
        original_url: url,
        cached_url: cachedUrl,
        type,
        filename,
      },
      {
        onConflict: "original_url",
      },
    );

    res.json({
      cachedUrl,
      cached: true,
      source: "freshly-cached",
    });
  } catch (error) {
    console.error("Image cache error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/images/cached - Check if an image is already cached
imagesRouter.get("/cached", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    const { data } = await getSupabase()
      .from("x402_cached_images")
      .select("cached_url")
      .eq("original_url", url)
      .maybeSingle();

    if (data?.cached_url) {
      return res.json({ cachedUrl: data.cached_url, cached: true });
    }

    res.json({ cached: false });
  } catch (error) {
    console.error("Image cache check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
