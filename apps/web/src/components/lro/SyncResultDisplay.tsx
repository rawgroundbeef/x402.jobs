"use client";

import { useMemo } from "react";
import { Copy, Check } from "lucide-react";

interface SyncResultDisplayProps {
  data: Record<string, unknown>;
  outputCopied: boolean;
  onCopyOutput: (text: string) => void;
}

/** Extract image URLs from various response shapes (imageDataUrl, images as string[] or [{url}]) */
function extractImageUrls(data: Record<string, unknown>): string[] {
  if (
    typeof data.imageDataUrl === "string" &&
    data.imageDataUrl.startsWith("data:image/")
  ) {
    return [data.imageDataUrl];
  }

  if (Array.isArray(data.images)) {
    return (data.images as Array<string | { url: string }>)
      .map((img) => (typeof img === "string" ? img : img?.url))
      .filter((url): url is string => !!url);
  }

  return [];
}

/** Truncate base64 data URLs for raw JSON display */
function truncateBase64(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("data:")) {
    const sizeKB = Math.round(value.length / 1024);
    const mimeMatch = value.match(/^data:([^;]+)/);
    const mimeType = mimeMatch?.[1] || "unknown";
    return `[${mimeType} - ${sizeKB}KB base64]`;
  }
  return value;
}

export function SyncResultDisplay({
  data,
  outputCopied,
  onCopyOutput,
}: SyncResultDisplayProps) {
  const imageUrls = useMemo(() => extractImageUrls(data), [data]);
  const jsonText = useMemo(
    () => JSON.stringify(data, truncateBase64, 2),
    [data],
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Output</h3>
        <button
          onClick={() => onCopyOutput(jsonText)}
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

      {imageUrls.length > 0 && (
        <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
          {imageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Generated image ${i + 1}`}
              className="max-w-full max-h-[400px] rounded-lg mx-auto"
            />
          ))}
        </div>
      )}

      <div className="bg-muted rounded-lg overflow-hidden">
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
          {jsonText}
        </pre>
      </div>
    </div>
  );
}
