"use client";

import React, { useRef, useEffect } from "react";
import { useConversation } from "./ConversationContext";
import { ResourceSuggestionCard } from "./ResourceSuggestionCard";
import { WiringProposalCard } from "./WiringProposalCard";
import { ParameterSelectionCard } from "./ParameterSelectionCard";
import { FinalSummaryCard } from "./FinalSummaryCard";
import type { ChatMessage, StructuredContent } from "./types";
import { Loader2, Sparkles, User } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 text-white",
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex-1 max-w-[85%]",
          isUser ? "text-right" : "text-left",
        )}
      >
        {/* Text content */}
        {message.content && (
          <div
            className={cn(
              "inline-block px-4 py-2.5 rounded-2xl text-sm",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted text-foreground rounded-bl-md",
            )}
          >
            {message.content}
          </div>
        )}

        {/* Structured content */}
        {message.structuredContent && (
          <div className="mt-3">
            <StructuredContentRenderer content={message.structuredContent} />
          </div>
        )}
      </div>
    </div>
  );
}

function StructuredContentRenderer({
  content,
}: {
  content: StructuredContent;
}) {
  switch (content.type) {
    case "resource_suggestion":
      return <ResourceSuggestionCard content={content} />;
    case "wiring_proposal":
      return <WiringProposalCard content={content} />;
    case "parameter_selection":
      return <ParameterSelectionCard content={content} />;
    case "final_summary":
      return <FinalSummaryCard content={content} />;
    case "thinking":
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{content.text}</span>
        </div>
      );
    case "error":
      return (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <p>{content.message}</p>
          {content.suggestion && (
            <p className="text-muted-foreground mt-1 text-xs">
              {content.suggestion}
            </p>
          )}
        </div>
      );
    default:
      return null;
  }
}

function LoadingIndicator() {
  return (
    <div className="flex gap-3 animate-in fade-in duration-300">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-blue-500 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" />
        </div>
      </div>
    </div>
  );
}

export function ChatThread() {
  const { state } = useConversation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages, state.isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
      {state.messages.length === 0 && !state.isLoading && (
        <div className="text-center text-muted-foreground py-12">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">
            Describe what you want to build and I&apos;ll help you create a
            workflow.
          </p>
        </div>
      )}

      {state.messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}

      {state.isLoading && <LoadingIndicator />}
    </div>
  );
}
