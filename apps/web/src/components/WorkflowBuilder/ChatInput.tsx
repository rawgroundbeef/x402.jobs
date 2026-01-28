"use client";

import React, { useState, useRef, useEffect } from "react";
import { useConversation } from "./ConversationContext";
import { Button } from "@x402jobs/ui/button";
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";
import { ChainIcon } from "@/components/icons/ChainIcons";

interface WorkflowChatInputProps {
  onSendMessage: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function WorkflowChatInput({
  onSendMessage,
  placeholder = "Describe what you want to build...",
  disabled = false,
}: WorkflowChatInputProps) {
  const { state, setNetwork } = useConversation();
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled || state.isLoading) return;

    onSendMessage(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled && !state.isLoading;

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-border">
      <div className="relative">
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-background transition-colors p-2",
            "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
          )}
        >
          {/* Network toggle */}
          <button
            type="button"
            onClick={() =>
              setNetwork(
                state.workflow.network === "solana" ? "base" : "solana",
              )
            }
            className={cn(
              "p-2 rounded-xl transition-colors hover:bg-muted shrink-0 self-center",
              state.workflow.network === "base"
                ? "text-blue-500"
                : "text-purple-500",
            )}
            title={`${state.workflow.network === "base" ? "Base" : "Solana"} • Click to switch`}
          >
            <ChainIcon network={state.workflow.network} className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || state.isLoading}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              "min-h-[40px] py-2.5 px-1",
            )}
          />

          {/* Submit button */}
          <Button
            type="submit"
            size="icon"
            disabled={!canSubmit}
            className={cn(
              "w-9 h-9 rounded-xl shrink-0 transition-all",
              canSubmit
                ? "bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90"
                : "",
            )}
          >
            {state.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : canSubmit ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </form>
  );
}
