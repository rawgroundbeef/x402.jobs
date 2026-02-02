"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import {
  Monitor,
  X,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Copy,
  Check,
} from "lucide-react";
import type { OutputConfig } from "@/types/output-config";
import type { X402StorageResult } from "@/lib/x402-storage";
import { truncateBase64 } from "@/lib/media-utils";

// x402.storage icon (cardboard box)
function X402StorageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 222 222" className={className} fill="none">
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06L43.96 158.76V92.16L110.56 125.46Z"
        fill="#8B7355"
      />
      <path
        d="M43.96 92.16L110.56 125.46V192.06L43.96 158.76V92.16Z"
        fill="#7A6345"
      />
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06V125.46Z"
        fill="#6B5344"
      />
      <path
        d="M43.96 92.16L110.56 61.08L177.16 92.16L110.56 125.46L43.96 92.16Z"
        fill="#A08060"
      />
      <path
        d="M43.96 92.16L110.56 61.08L79.48 30L4 65.52L43.96 92.16Z"
        fill="#C4A77D"
      />
      <path
        d="M177.16 92.16L110.56 61.08L141.64 30L217.12 65.52L177.16 92.16Z"
        fill="#B8956F"
      />
    </svg>
  );
}

type OutputNodeData = {
  result?: string | null;
  isLoading?: boolean;
  outputConfig?: OutputConfig;
  x402storageUrls?: X402StorageResult[]; // Storage URLs from upload
  x402storageError?: string; // Storage error if failed
  onDelete?: (nodeId: string) => void;
  onViewOutput?: (result: string | null | undefined, nodeId?: string) => void;
  onConfigure?: (nodeId: string) => void;
};

type OutputNodeType = Node<OutputNodeData, "output">;

// Check if a string is a URL
function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

// Check if a string is a data URL (base64 encoded)
function isDataUrl(str: string): boolean {
  return str.startsWith("data:");
}

// Check if a data URL is an image
function isImageDataUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

// Check if a URL is an image
function isImageUrl(url: string): boolean {
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some((ext) => lowerUrl.includes(ext));
}

// Check if a URL is a video
function isVideoUrl(url: string): boolean {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some((ext) => lowerUrl.includes(ext));
}

// Truncate URL in the middle for display
function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const start = Math.ceil((maxLength - 3) / 2);
  const end = Math.floor((maxLength - 3) / 2);
  return str.slice(0, start) + "..." + str.slice(-end);
}

// Format the result for display
function formatResult(result: string): {
  display: string;
  isImage: boolean;
  isVideo: boolean;
  mediaUrl: string | null;
} {
  const trimmed = result.trim();

  // If the result is a data URL (base64 image), handle it directly
  if (isDataUrl(trimmed)) {
    return {
      display: "Base64 Image",
      isImage: isImageDataUrl(trimmed),
      isVideo: false,
      mediaUrl: trimmed,
    };
  }

  // If the result itself is a URL, handle it directly
  if (isUrl(trimmed)) {
    return {
      display: trimmed,
      isImage: isImageUrl(trimmed),
      isVideo: isVideoUrl(trimmed),
      mediaUrl: trimmed,
    };
  }

  // Try to parse as JSON and extract artifactUrl if present
  try {
    const parsed = JSON.parse(trimmed);

    // Check for imageDataUrl (base64 encoded image from binary response)
    if (
      parsed.imageDataUrl &&
      typeof parsed.imageDataUrl === "string" &&
      isDataUrl(parsed.imageDataUrl)
    ) {
      return {
        display: "Base64 Image",
        isImage: isImageDataUrl(parsed.imageDataUrl),
        isVideo: false,
        mediaUrl: parsed.imageDataUrl,
      };
    }

    // Check for artifactUrl (common pattern for generated media)
    const artifactUrl =
      parsed.artifactUrl ||
      parsed.artifact_url ||
      parsed.imageUrl ||
      parsed.image_url ||
      parsed.videoUrl ||
      parsed.video_url;

    if (artifactUrl && typeof artifactUrl === "string" && isUrl(artifactUrl)) {
      return {
        display: JSON.stringify(parsed, truncateBase64, 2),
        isImage: isImageUrl(artifactUrl),
        isVideo: isVideoUrl(artifactUrl),
        mediaUrl: artifactUrl,
      };
    }

    // Also check nested response.artifactUrl pattern
    if (parsed.response && typeof parsed.response === "object") {
      const nestedArtifact =
        parsed.response.artifactUrl || parsed.response.artifact_url;
      if (
        nestedArtifact &&
        typeof nestedArtifact === "string" &&
        isUrl(nestedArtifact)
      ) {
        return {
          display: JSON.stringify(parsed, truncateBase64, 2),
          isImage: isImageUrl(nestedArtifact),
          isVideo: isVideoUrl(nestedArtifact),
          mediaUrl: nestedArtifact,
        };
      }
    }

    // Check inside nested resource objects (e.g. {"resource-1": {imageDataUrl: "..."}})
    if (typeof parsed === "object" && parsed !== null) {
      for (const val of Object.values(parsed)) {
        if (typeof val === "object" && val !== null) {
          const nested = val as Record<string, unknown>;
          if (
            typeof nested.imageDataUrl === "string" &&
            isDataUrl(nested.imageDataUrl)
          ) {
            return {
              display: JSON.stringify(parsed, truncateBase64, 2),
              isImage: isImageDataUrl(nested.imageDataUrl),
              isVideo: false,
              mediaUrl: nested.imageDataUrl,
            };
          }
          const nestedArtifact =
            nested.artifactUrl || nested.artifact_url;
          if (
            typeof nestedArtifact === "string" &&
            isDataUrl(nestedArtifact)
          ) {
            return {
              display: JSON.stringify(parsed, truncateBase64, 2),
              isImage: isImageDataUrl(nestedArtifact),
              isVideo: false,
              mediaUrl: nestedArtifact as string,
            };
          }
        }
      }
    }

    return {
      display: JSON.stringify(parsed, truncateBase64, 2),
      isImage: false,
      isVideo: false,
      mediaUrl: null,
    };
  } catch {
    // Not JSON, just return as-is
    return {
      display: trimmed,
      isImage: false,
      isVideo: false,
      mediaUrl: null,
    };
  }
}

export function OutputNode({ id, data, selected }: NodeProps<OutputNodeType>) {
  const hasResult = Boolean(data.result);
  const isError = data.result?.startsWith("❌");
  const isSuccess = hasResult && !isError && !data.isLoading;

  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Format the result - no magic extraction, just display what we receive
  const formatted = data.result ? formatResult(data.result) : null;

  return (
    <div
      className={`bg-background border-2 rounded-lg p-3 min-w-[180px] max-w-[280px] transition-all relative group ${
        isError
          ? "border-destructive shadow-lg shadow-destructive/20"
          : selected
            ? "border-output shadow-lg shadow-output/20"
            : "border-output/50"
      }`}
      onDoubleClick={() => data.onConfigure?.(id)}
    >
      {/* Delete button */}
      {data.onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/80"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Action buttons - top right */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {/* Configure button - show on hover when no result */}
        {data.onConfigure && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onConfigure?.(id);
            }}
            className={`w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded flex items-center justify-center transition-all ${
              hasResult ? "" : "opacity-0 group-hover:opacity-100"
            }`}
            title="Configure output destinations"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Expand button - only show when there's a result */}
        {hasResult && data.onViewOutput && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onViewOutput?.(data.result, id);
            }}
            className="w-6 h-6 bg-muted hover:bg-accent text-muted-foreground hover:text-foreground rounded flex items-center justify-center transition-colors"
            title="View full output"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-output border-2 border-card"
      />

      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center ${
            isError
              ? "bg-destructive/20 text-destructive"
              : isSuccess
                ? "bg-emerald-500/20 text-emerald-500"
                : "bg-output/20 text-output"
          }`}
        >
          {isError ? (
            <AlertCircle className="w-4 h-4" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
        </div>
        <span
          className={`font-semibold text-sm ${isError ? "text-destructive" : ""}`}
        >
          {isError ? "Error" : isSuccess ? "Complete" : "Output"}
        </span>
      </div>

      {/* Output content - clickable when there's a result */}
      {data.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
          Running...
        </div>
      ) : formatted ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            data.onViewOutput?.(data.result, id);
          }}
          className={`cursor-pointer rounded p-1 -m-1 transition-colors ${
            isError
              ? "bg-destructive/10 hover:bg-destructive/20"
              : "hover:bg-muted/50"
          }`}
          title="Click to view full output"
        >
          {/* Render media only if the DIRECT result is an image/video URL (no extraction) */}
          {formatted.isImage && formatted.mediaUrl ? (
            <div className="space-y-2">
              <img
                src={formatted.mediaUrl}
                alt="Generated output"
                className="w-full rounded-md pointer-events-none"
                onError={(e) => {
                  // Hide image on error, show text instead
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <p className="text-xs text-muted-foreground truncate pointer-events-none">
                {formatted.mediaUrl}
              </p>
            </div>
          ) : formatted.isVideo && formatted.mediaUrl ? (
            <div className="space-y-2">
              <video
                src={formatted.mediaUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="w-full rounded-md"
                onError={(e) => {
                  // Hide video on error, show text instead
                  (e.target as HTMLVideoElement).style.display = "none";
                }}
              />
              <p className="text-xs text-muted-foreground truncate pointer-events-none">
                {formatted.mediaUrl}
              </p>
            </div>
          ) : (
            <pre
              className={`text-xs whitespace-pre-wrap break-words font-mono max-h-48 overflow-y-auto pointer-events-none ${
                isError ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatted.display}
            </pre>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs italic">
          Output appears here
        </p>
      )}

      {/* Storage URLs section */}
      {data.x402storageUrls && data.x402storageUrls.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
            <X402StorageIcon className="w-3 h-3" />
            <span>Stored permanently</span>
          </div>
          <div className="space-y-1.5">
            {data.x402storageUrls.map((item, idx) =>
              item.success && item.url ? (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  {item.filename && (
                    <span className="text-muted-foreground truncate max-w-[60px]">
                      {item.filename}
                    </span>
                  )}
                  <span
                    className="font-mono text-emerald-600 dark:text-emerald-400 truncate flex-1"
                    title={item.url}
                  >
                    {truncateMiddle(item.url, 32)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyUrl(item.url!);
                    }}
                    className="p-1 rounded hover:bg-accent text-muted-foreground shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl === item.url ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Storage error */}
      {data.x402storageError && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3 h-3" />
            <span>Storage failed: {data.x402storageError}</span>
          </div>
        </div>
      )}
    </div>
  );
}
