"use client";

import * as React from "react";
import { cn } from "./lib/utils";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxRows?: number;
  minRows?: number;
  className?: string;
  /** Visual variant - 'default' has border, 'ghost' has no border */
  variant?: "default" | "ghost";
  /** Use animated gradient border instead of solid border */
  gradientBorder?: boolean;
  /** Custom send button icon - defaults to lightning bolt */
  sendIcon?: React.ReactNode;
  /** Additional adornments to show (left side) */
  leftAdornments?: React.ReactNode;
  /** Additional adornments to show (right side, before send button) */
  rightAdornments?: React.ReactNode;
}

const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      placeholder = "Type a message...",
      disabled = false,
      isLoading = false,
      maxRows = 6,
      minRows = 1,
      className,
      variant = "default",
      gradientBorder = false,
      sendIcon,
      leftAdornments,
      rightAdornments,
    },
    ref,
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [rows, setRows] = React.useState(minRows);

    // Combine refs
    React.useImperativeHandle(ref, () => textareaRef.current!);

    // Auto-resize based on content
    React.useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset to min height to get accurate scrollHeight
      textarea.style.height = "auto";

      // Calculate line height (approximate)
      const lineHeight = 24; // ~1.5rem for text-sm/base
      const paddingY = 24; // py-3 = 12px * 2
      const contentHeight = textarea.scrollHeight - paddingY;
      const newRows = Math.min(
        maxRows,
        Math.max(minRows, Math.ceil(contentHeight / lineHeight)),
      );

      setRows(newRows);

      // Set the actual height
      const maxHeight = lineHeight * maxRows + paddingY;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [value, maxRows, minRows]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && !isLoading && value.trim()) {
          onSubmit();
        }
      }
    };

    const isExpanded = rows > 1;
    const canSend = !disabled && !isLoading && value.trim().length > 0;

    // For gradient borders with rounded corners, we use a wrapper approach
    // Inner radius = outer radius - border width (2px) for perfect alignment
    const borderRadius = isExpanded ? "rounded-2xl" : "rounded-full";
    // For rounded-full, inner should also be rounded-full (both are effectively circles)
    // For rounded-2xl (16px), inner should be 14px (16-2)
    const innerBorderRadius = isExpanded ? "rounded-[14px]" : "rounded-full";

    const content = (
      <div
        className={cn(
          "relative flex gap-2 transition-all w-full min-w-0",
          isExpanded ? "items-end" : "items-center",
          variant === "default" && "bg-background",
          variant === "ghost" && "bg-muted/50",
          // Use inner radius for gradient border, outer radius otherwise
          variant === "default" && gradientBorder
            ? innerBorderRadius
            : borderRadius,
          // For non-gradient default, add a solid border
          variant === "default" && !gradientBorder && "border border-input",
          variant === "ghost" && className,
        )}
      >
        {/* Left adornments */}
        {leftAdornments && (
          <div
            className={cn(
              "flex items-center gap-1 pl-3 shrink-0",
              isExpanded ? "self-end pb-2" : "self-center",
            )}
          >
            {leftAdornments}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            "flex-1 min-w-0 resize-none bg-transparent text-sm placeholder:text-muted-foreground placeholder:font-semibold disabled:cursor-not-allowed disabled:opacity-50 self-end",
            leftAdornments ? "pl-1" : "pl-4",
            "pr-1",
            "py-2.5",
          )}
          style={{
            minHeight: "40px",
            maxHeight: `${24 * maxRows + 24}px`,
            border: "none",
            outline: "none",
            boxShadow: "none",
          }}
        />

        {/* Right side: adornments + send button */}
        <div
          className={cn(
            "flex items-center gap-1 pr-2 shrink-0",
            isExpanded ? "self-end pb-2" : "self-center",
          )}
        >
          {rightAdornments}

          {/* Send button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              canSend
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : sendIcon ? (
              sendIcon
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );

    // For ghost variant or when no gradient border is needed
    if (variant === "ghost" || !gradientBorder) {
      return (
        <div className={cn("w-full", borderRadius, className)}>{content}</div>
      );
    }

    // Wrap with animated gradient border container
    // Using inline styles + CSS class for maximum compatibility
    return (
      <div
        className={cn(
          "p-[2px] w-full transition-all animated-gradient-border hover:shadow-lg hover:shadow-primary/20 focus-within:shadow-xl focus-within:shadow-primary/30",
          borderRadius,
          className,
        )}
        style={{
          background:
            "linear-gradient(90deg, #10b981, #14b8a6, #06b6d4, #0ea5e9, #3b82f6, #8b5cf6, #a855f7, #8b5cf6, #3b82f6, #0ea5e9, #06b6d4, #14b8a6, #10b981)",
          backgroundSize: "400% 100%",
          animation: "gradient-shift 6s ease infinite",
        }}
      >
        {content}
      </div>
    );
  },
);

ChatInput.displayName = "ChatInput";

export { ChatInput };
