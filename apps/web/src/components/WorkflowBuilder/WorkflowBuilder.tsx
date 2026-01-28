"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ConversationProvider, useConversation } from "./ConversationContext";
import { ChatThread } from "./ChatThread";
import { WorkflowChatInput } from "./ChatInput";
import { WorkflowPreview } from "./WorkflowPreview";
import { useConversationFlow } from "./useConversationFlow";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import { ArrowLeft } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@x402jobs/ui/utils";

interface WorkflowBuilderInnerProps {
  initialPrompt?: string;
}

function WorkflowBuilderInner({ initialPrompt }: WorkflowBuilderInnerProps) {
  const router = useRouter();
  const { state } = useConversation();
  const { handleMessage, handleInitialPrompt, handleCreateJob, isLoading } =
    useConversationFlow();

  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Handle initial prompt on mount
  useEffect(() => {
    if (initialPrompt && !hasStarted) {
      setHasStarted(true);
      handleInitialPrompt(initialPrompt);
    }
  }, [initialPrompt, hasStarted, handleInitialPrompt]);

  // Handler for sending messages
  const onSendMessage = useCallback(
    (message: string) => {
      if (!hasStarted) {
        setHasStarted(true);
      }
      handleMessage(message);
    },
    [hasStarted, handleMessage],
  );

  const hasResources = state.workflow.selectedResourceIds.length > 0;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row">
      {/* Chat section */}
      <div className="flex-1 flex flex-col min-w-0 lg:border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Create with AI</h1>
            <p className="text-sm text-muted-foreground">
              Build your workflow through conversation
            </p>
          </div>
        </div>

        {/* Chat thread */}
        <ChatThread />

        {/* Input */}
        <WorkflowChatInput
          onSendMessage={onSendMessage}
          disabled={state.step === "complete"}
        />
      </div>

      {/* Preview section - Desktop */}
      <div
        className={cn(
          "hidden lg:flex lg:w-[400px] xl:w-[450px] flex-col bg-muted/30 shrink-0",
        )}
      >
        <WorkflowPreview
          onCreateJob={handleCreateJob}
          isCreating={isLoading && state.step === "review"}
        />
      </div>

      {/* Preview section - Mobile (collapsible bottom bar) */}
      <div className="lg:hidden border-t border-border bg-background">
        {mobilePreviewExpanded ? (
          <div className="h-[60vh] flex flex-col">
            <WorkflowPreview
              onCreateJob={handleCreateJob}
              isCreating={isLoading && state.step === "review"}
              onToggleCollapse={() => setMobilePreviewExpanded(false)}
            />
          </div>
        ) : hasResources ? (
          <WorkflowPreview
            collapsed
            onToggleCollapse={() => setMobilePreviewExpanded(true)}
            onCreateJob={handleCreateJob}
            isCreating={isLoading && state.step === "review"}
          />
        ) : null}
      </div>
    </div>
  );
}

interface WorkflowBuilderProps {
  initialPrompt?: string;
  initialName?: string;
  initialNetwork?: NetworkType;
}

export function WorkflowBuilder({
  initialPrompt,
  initialName: _initialName,
  initialNetwork = "solana",
}: WorkflowBuilderProps) {
  return (
    <ConversationProvider
      initialPrompt={initialPrompt}
      initialNetwork={initialNetwork}
    >
      <WorkflowBuilderInner initialPrompt={initialPrompt} />
    </ConversationProvider>
  );
}
