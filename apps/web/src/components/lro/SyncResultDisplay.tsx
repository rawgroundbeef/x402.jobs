"use client";

import { useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { extractImageUrls, truncateBase64 } from "./media-utils";

interface SyncResultDisplayProps {
  data: Record<string, unknown>;
  outputCopied: boolean;
  onCopyOutput: (text: string) => void;
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
