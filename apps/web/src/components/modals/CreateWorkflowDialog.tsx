"use client";

import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { ChatInput } from "@x402jobs/ui/chat-input";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { ChainIcon } from "@/components/icons/ChainIcons";
import { JOBPUTER_AVATAR_URL } from "@/lib/config";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import { formatUsd } from "@/lib/format";
import { cn } from "@x402jobs/ui/utils";
import {
  X,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

// ============================================================================
// Types & Helpers
// ============================================================================

// Generate a unique key for a resource using serverSlug/slug
// This ensures resources with the same name from different servers are distinct
function getResourceKey(resource: {
  serverSlug?: string;
  slug?: string;
  name?: string;
  id?: string;
}): string {
  if (resource.serverSlug && (resource.slug || resource.name)) {
    return `${resource.serverSlug}/${resource.slug || resource.name}`;
  }
  return resource.id || `${resource.slug || resource.name}`;
}

interface DraftResource {
  id: string;
  name: string;
  slug: string;
  serverSlug: string;
  description: string;
  cost: number;
  position: number;
}

interface WorkflowDraft {
  name: string | null;
  resources: DraftResource[];
  totalCost: number;
  status: "empty" | "building" | "ready" | "created";
  createdJobId?: string;
  createdJobName?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  searchResults?: DraftResource[]; // Attached to messages that triggered a search
}

interface ToolResult {
  tool: string;
  result: unknown;
}

interface ChatResponse {
  message: string;
  draft: WorkflowDraft;
  toolResults: ToolResult[];
  searchResults?: DraftResource[];
}

// ============================================================================
// Jobputer Avatar Component
// ============================================================================

function JobputerAvatar({ className }: { className?: string }) {
  return (
    <img
      src={JOBPUTER_AVATAR_URL}
      alt="Jobputer"
      className={cn("w-8 h-8 rounded-full object-cover", className)}
    />
  );
}

// ============================================================================
// Component
// ============================================================================

interface CreateWorkflowDialogProps {
  open: boolean;
  onClose: () => void;
  initialPrompt?: string;
  initialNetwork?: NetworkType;
}

export function CreateWorkflowDialog({
  open,
  onClose,
  initialPrompt = "",
  initialNetwork = "solana",
}: CreateWorkflowDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [network, setNetwork] = useState<NetworkType>(initialNetwork);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft workflow state
  const [draft, setDraft] = useState<WorkflowDraft>({
    name: null,
    resources: [],
    totalCost: 0,
    status: "empty",
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-focus action button when it appears and loading is done
  const shouldFocusButton = useMemo(
    () =>
      !isLoading &&
      // Focus Continue/Create Job buttons
      ((draft.resources.length > 0 &&
        (draft.status === "building" || draft.status === "ready")) ||
        // Focus View Job button
        draft.status === "created"),
    [isLoading, draft.resources.length, draft.status],
  );

  useEffect(() => {
    if (shouldFocusButton && actionButtonRef.current) {
      // Small delay to ensure button is rendered
      const timer = setTimeout(() => {
        actionButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldFocusButton]);

  // Handle initial prompt when dialog opens
  useEffect(() => {
    if (open && initialPrompt && messages.length === 0) {
      handleSendMessage(initialPrompt);
    }
  }, [open, initialPrompt]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setMessages([]);
        setInputValue("");
        setIsLoading(false);
        setError(null);
        setDraft({
          name: null,
          resources: [],
          totalCost: 0,
          status: "empty",
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Send message to the conversational API
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      // Check auth
      if (!user) {
        onClose();
        router.push(
          `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }

      const newUserMessage: ChatMessage = { role: "user", content };
      const updatedMessages = [...messages, newUserMessage];
      setMessages(updatedMessages);
      setInputValue("");
      setIsLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch("/workflow/chat", {
          method: "POST",
          body: JSON.stringify({
            messages: updatedMessages,
            draft,
            network,
          }),
        });

        if (!response.ok) {
          const err = await response
            .json()
            .catch(() => ({ error: "Request failed" }));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const data: ChatResponse = await response.json();

        // Update messages with AI response
        if (data.message) {
          // Attach searchResults to the assistant message if present
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: data.message,
            searchResults:
              data.searchResults && data.searchResults.length > 0
                ? data.searchResults
                : undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        // Update draft state
        if (data.draft) {
          setDraft(data.draft);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        setError(message);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${message}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, draft, network, isLoading, user, onClose, router],
  );

  // Handle viewing the created job
  const handleViewJob = useCallback(() => {
    if (draft.createdJobId) {
      onClose();
      router.push(`/jobs/${draft.createdJobId}`);
    }
  }, [draft.createdJobId, onClose, router]);

  // Handle retry
  const handleRetry = useCallback(() => {
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    if (lastUserMessage) {
      // Remove last two messages (user + error response) and retry
      setMessages((prev) => prev.slice(0, -2));
      setError(null);
      setTimeout(() => handleSendMessage(lastUserMessage.content), 100);
    }
  }, [messages, handleSendMessage]);

  // Handle toggling a resource in/out of the draft
  const handleToggleResource = useCallback((resource: DraftResource) => {
    setDraft((prev) => {
      const resourceKey = getResourceKey(resource);
      const isInDraft = prev.resources.some(
        (r) => getResourceKey(r) === resourceKey,
      );

      if (isInDraft) {
        // Remove from draft
        const newResources = prev.resources.filter(
          (r) => getResourceKey(r) !== resourceKey,
        );
        return {
          ...prev,
          resources: newResources,
          totalCost: newResources.reduce((sum, r) => sum + r.cost, 0),
          status: newResources.length === 0 ? "empty" : "building",
        };
      } else {
        // Add to draft with next position
        const maxPosition = Math.max(
          0,
          ...prev.resources.map((r) => r.position),
        );
        const newResource = { ...resource, position: maxPosition + 1 };
        const newResources = [...prev.resources, newResource];
        return {
          ...prev,
          resources: newResources,
          totalCost: newResources.reduce((sum, r) => sum + r.cost, 0),
          status: "building",
        };
      }
    });
  }, []);

  const isInputDisabled = isLoading || draft.status === "created";
  const showInput = draft.status !== "created";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        showClose={false}
        className={cn(
          "p-0 flex flex-col overflow-hidden",
          // Mobile: full screen
          "w-full h-full max-w-full max-h-full rounded-none",
          // Desktop: fixed size modal - no jumping!
          "sm:w-[560px] sm:max-w-[560px] sm:h-[80vh] sm:max-h-[700px] sm:rounded-lg",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 sm:p-4 border-b border-border shrink-0">
          {/* Mobile: Back arrow + title */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile back button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="sm:hidden h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {/* Desktop: Jobputer avatar */}
            <JobputerAvatar className="hidden sm:block" />
            <div>
              <h2 className="font-semibold text-sm sm:text-base">
                Create Workflow
              </h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Build your workflow through conversation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Network badge */}
            <button
              onClick={() =>
                setNetwork(network === "solana" ? "base" : "solana")
              }
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                network === "base"
                  ? "bg-blue-500/10 text-blue-500"
                  : "bg-purple-500/10 text-purple-500",
              )}
              title="Click to switch network"
            >
              <ChainIcon network={network} className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{network}</span>
            </button>
            {/* Desktop: X close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hidden sm:flex"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Chat area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4"
        >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground py-8 sm:py-12">
              <JobputerAvatar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-75" />
              <p className="text-sm px-4">
                Describe what you want to build and I&apos;ll help you create a
                workflow.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 px-2">
                {["Flight JFK → Bali", "Image → Video", "Profile picture"].map(
                  (example) => (
                    <button
                      key={example}
                      onClick={() => handleSendMessage(example)}
                      className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-full transition-colors"
                    >
                      {example}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              searchResults={message.searchResults}
              draftResources={draft.resources}
              onToggleResource={handleToggleResource}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-end gap-3">
              <JobputerAvatar className="shrink-0 w-7 h-7 sm:w-8 sm:h-8" />
              <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-muted flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="border-t border-border shrink-0">
          {/* Success State */}
          {draft.status === "created" && draft.createdJobId && (
            <div className="p-3 sm:p-4 flex items-center justify-between bg-emerald-500/5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 min-w-0">
                <Check className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">
                  Created "{draft.createdJobName}"
                </span>
              </div>
              <Button
                ref={actionButtonRef}
                size="sm"
                onClick={handleViewJob}
                className="gap-2 shrink-0 ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background focus:ring-emerald-500"
              >
                View Job
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Error State */}
          {error && draft.status !== "created" && (
            <div className="p-3 sm:p-4 flex items-center justify-between bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">
                  Something went wrong
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetry}
                className="gap-2 shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Try Again</span>
              </Button>
            </div>
          )}

          {/* Input Area */}
          {showInput && !error && (
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={() => {
                  if (inputValue.trim()) {
                    handleSendMessage(inputValue.trim());
                  }
                }}
                placeholder="e.g., Generate an image..."
                isLoading={isLoading}
                disabled={isInputDisabled}
                gradientBorder
                leftAdornments={
                  <button
                    type="button"
                    onClick={() =>
                      setNetwork(network === "solana" ? "base" : "solana")
                    }
                    className={cn(
                      "p-1.5 rounded-lg transition-colors hover:bg-muted",
                      network === "base" ? "text-blue-500" : "text-purple-500",
                    )}
                    title={`${network === "base" ? "Base" : "Solana"} • Click to switch`}
                  >
                    <ChainIcon
                      network={network}
                      className="w-4 h-4 sm:w-5 sm:h-5"
                    />
                  </button>
                }
              />

              {/* Draft summary + action button */}
              {draft.resources.length > 0 &&
                (draft.status === "building" || draft.status === "ready") && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-muted-foreground">
                      {draft.status === "ready" && (
                        <Check className="w-3 h-3 inline mr-1" />
                      )}
                      {draft.resources.length} step
                      {draft.resources.length !== 1 ? "s" : ""} •{" "}
                      {formatUsd(draft.totalCost)}/run
                    </span>

                    {draft.status === "building" ? (
                      // Step 1: User has selected resources, needs to continue for AI to propose order
                      <Button
                        ref={actionButtonRef}
                        type="button"
                        size="sm"
                        onClick={() => {
                          // For single resource, skip refinement
                          if (draft.resources.length === 1) {
                            handleSendMessage("create it");
                          } else {
                            // Ask AI to analyze selection and propose workflow order
                            // Include serverSlug to distinguish resources with the same name from different servers
                            const resourceNames = draft.resources
                              .map((r) =>
                                r.serverSlug
                                  ? `${r.serverSlug}/${r.slug || r.name}`
                                  : r.slug || r.name,
                              )
                              .join(", ");
                            handleSendMessage(
                              `Continue with these ${draft.resources.length} resources: ${resourceNames}`,
                            );
                          }
                        }}
                        disabled={isLoading}
                        className="gap-1.5 ring-2 ring-primary/50 ring-offset-2 ring-offset-background focus:ring-primary"
                      >
                        Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      // Step 2: AI has proposed the workflow, user can create
                      <Button
                        ref={actionButtonRef}
                        type="button"
                        size="sm"
                        onClick={() => handleSendMessage("create it")}
                        disabled={isLoading}
                        className="gap-1.5 ring-2 ring-primary/50 ring-offset-2 ring-offset-background focus:ring-primary"
                      >
                        Create Job
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  searchResults?: DraftResource[];
  draftResources: DraftResource[];
  onToggleResource?: (resource: DraftResource) => void;
}

function MessageBubble({
  message,
  searchResults,
  draftResources,
  onToggleResource,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Check if a resource is in the current draft (using composite key for uniqueness)
  const isInDraft = (resource: DraftResource) =>
    draftResources.some((r) => getResourceKey(r) === getResourceKey(resource));

  return (
    <div
      className={cn(
        "flex items-end gap-2 sm:gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar - aligned to bubble bottom */}
      {!isUser && <JobputerAvatar className="shrink-0 w-7 h-7 sm:w-8 sm:h-8" />}

      {/* Content */}
      <div className={cn("flex-1 max-w-[85%]", isUser && "flex justify-end")}>
        {/* Text bubble */}
        <div
          className={cn(
            "px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-sm whitespace-pre-wrap",
            isUser
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted text-foreground rounded-bl-md",
          )}
        >
          {message.content}
        </div>

        {/* Search results (clickable to toggle selection) */}
        {searchResults && searchResults.length > 0 && (
          <div className="mt-2 sm:mt-3 space-y-2">
            {searchResults.map((resource) => {
              const inDraft = isInDraft(resource);
              return (
                <button
                  key={getResourceKey(resource)}
                  type="button"
                  onClick={() => onToggleResource?.(resource)}
                  className={cn(
                    "w-full p-2.5 sm:p-3 rounded-xl border text-left transition-all",
                    "hover:bg-muted/50 active:scale-[0.99]",
                    inDraft
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-background/50 hover:border-primary/30",
                  )}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {/* Checkbox indicator */}
                    <div
                      className={cn(
                        "w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        inDraft
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30 hover:border-primary/50",
                      )}
                    >
                      {inDraft && (
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs sm:text-sm truncate">
                        {resource.serverSlug && (
                          <span className="text-muted-foreground">
                            {resource.serverSlug}/
                          </span>
                        )}
                        {resource.slug || resource.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {resource.description}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {formatUsd(resource.cost)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
