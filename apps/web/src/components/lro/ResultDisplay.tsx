"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Copy,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Download,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { LROResult, LROPayment } from "./types";

interface ResultDisplayProps {
  result: LROResult;
  payment?: LROPayment | null;
  showFullResult?: boolean;
  onShowFullResultToggle?: () => void;
  outputCopied: boolean;
  onCopyOutput: (text: string) => void;
}

// Check if URL points to an image (including base64 data URLs)
function isImageUrl(url: string): boolean {
  // Check for base64 data URL
  if (url.startsWith("data:image/")) {
    return true;
  }
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
  ];
  const lowercaseUrl = url.toLowerCase();
  return imageExtensions.some((ext) => lowercaseUrl.includes(ext));
}

// Check if URL points to a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov"];
  const lowercaseUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowercaseUrl.includes(ext));
}

// Check if URL points to audio
function isAudioUrl(url: string): boolean {
  const audioExtensions = [".mp3", ".wav", ".ogg", ".m4a"];
  const lowercaseUrl = url.toLowerCase();
  return audioExtensions.some((ext) => lowercaseUrl.includes(ext));
}

export function ResultDisplay({
  result,
  payment,
  showFullResult = false,
  onShowFullResultToggle,
  outputCopied,
  onCopyOutput,
}: ResultDisplayProps) {
  // Extract artifact URL, message, and images array from fullData
  const { artifactUrl, message, images } = useMemo(() => {
    const data = result.fullData as Record<string, unknown> | null;
    if (!data || typeof data !== "object") {
      return { artifactUrl: null, message: result.response, images: null };
    }

    // Check for OpenRouter images array first (from Phase 17)
    const imagesArray = data.images as string[] | undefined;

    // Check for imageDataUrl (base64), then other URL fields
    const url = (data.imageDataUrl ||
      data.artifactUrl ||
      data.imageUrl ||
      data.url ||
      (imagesArray && imagesArray[0])) as string | undefined;
    const msg = (data.response || data.message) as string | undefined;

    return {
      artifactUrl: url && typeof url === "string" ? url : null,
      message: msg || result.response,
      images: imagesArray && imagesArray.length > 0 ? imagesArray : null,
    };
  }, [result]);

  // Image loading state with retry logic
  const [imageState, setImageState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds between retries

  // Reset state when artifactUrl changes
  useEffect(() => {
    if (artifactUrl && isImageUrl(artifactUrl)) {
      setImageState("loading");
      setRetryCount(0);
    }
  }, [artifactUrl]);

  // Retry loading image after delay if it failed
  useEffect(() => {
    if (imageState === "error" && retryCount < maxRetries && artifactUrl) {
      const timer = setTimeout(() => {
        setRetryCount((c) => c + 1);
        setImageState("loading");
      }, retryDelay);
      return () => clearTimeout(timer);
    }
  }, [imageState, retryCount, artifactUrl]);

  const isLongResult = result.response.length > 500;
  const shouldTruncate =
    isLongResult && !showFullResult && onShowFullResultToggle;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          Output
          {payment && (
            <span className="text-xs font-normal text-muted-foreground">
              · Paid ${payment.amount.toFixed(2)}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {artifactUrl && (
            <a
              href={artifactUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
          )}
          <button
            onClick={() => onCopyOutput(artifactUrl || result.response)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {outputCopied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Multiple images gallery (OpenRouter image models) */}
      {images && images.length > 1 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {images.map((imgUrl, idx) => (
            <a
              key={idx}
              href={imgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={imgUrl}
                alt={`Generated image ${idx + 1}`}
                className="rounded-lg w-full h-auto border border-border"
              />
            </a>
          ))}
        </div>
      )}

      {/* Artifact Preview (single image or other media) */}
      {artifactUrl && !(images && images.length > 1) && (
        <div className="mb-3">
          {isImageUrl(artifactUrl) ? (
            <div className="relative">
              {/* Loading state */}
              {imageState === "loading" && (
                <div className="flex items-center justify-center py-12 bg-muted rounded-lg border border-border">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {retryCount > 0
                        ? `Loading image (attempt ${retryCount + 1}/${maxRetries + 1})...`
                        : "Loading image..."}
                    </p>
                  </div>
                </div>
              )}
              {/* Error state after all retries */}
              {imageState === "error" && retryCount >= maxRetries && (
                <div className="flex items-center justify-center py-12 bg-muted rounded-lg border border-border">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Image not available yet
                    </p>
                    <a
                      href={artifactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Open link directly
                    </a>
                  </div>
                </div>
              )}
              {/* Image (hidden while loading) */}
              <a
                href={artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block ${imageState !== "loaded" ? "hidden" : ""}`}
              >
                <img
                  key={`${artifactUrl}-${retryCount}`} // Force re-render on retry
                  src={artifactUrl}
                  alt="Generated content"
                  className="rounded-lg max-h-96 w-auto mx-auto border border-border"
                  onLoad={() => setImageState("loaded")}
                  onError={() => setImageState("error")}
                />
              </a>
            </div>
          ) : isVideoUrl(artifactUrl) ? (
            <video
              src={artifactUrl}
              controls
              className="rounded-lg max-h-96 w-full border border-border"
            />
          ) : isAudioUrl(artifactUrl) ? (
            <audio src={artifactUrl} controls className="w-full" />
          ) : (
            <a
              href={artifactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              {artifactUrl}
            </a>
          )}
        </div>
      )}

      {/* Message */}
      {message && typeof message === "string" && !artifactUrl && (
        <p className="text-sm text-muted-foreground mb-3">{message}</p>
      )}

      {/* Raw Response (collapsible if there's an artifact) */}
      <div
        className={`bg-muted rounded-lg overflow-hidden ${artifactUrl ? "opacity-75" : ""}`}
      >
        {artifactUrl && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
            Raw response
          </div>
        )}
        <pre
          className={`p-4 text-xs font-mono overflow-x-auto ${
            artifactUrl
              ? "max-h-32 overflow-y-auto"
              : shouldTruncate
                ? "max-h-32 overflow-hidden"
                : "max-h-80 overflow-y-auto"
          }`}
        >
          {result.response}
        </pre>
        {!artifactUrl && isLongResult && onShowFullResultToggle && (
          <button
            onClick={onShowFullResultToggle}
            className="w-full px-4 py-2 text-xs text-primary hover:bg-muted/80 flex items-center justify-center gap-1 border-t border-border"
          >
            {showFullResult ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
