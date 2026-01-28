"use client";

import { Button } from "@x402jobs/ui/button";
import { MessageCircle } from "lucide-react";
import { useModals } from "@/contexts/ModalContext";
import { JOBPUTER_HELP_COST } from "@/lib/config";

/**
 * Jobputer chat button that opens the global chat modal.
 * The modal itself is rendered at the app layout level.
 */
export function JobputerChatButton() {
  const { openJobputerChat } = useModals();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openJobputerChat}
      title={`Ask Jobputer ($${JOBPUTER_HELP_COST.toFixed(2)})`}
    >
      <MessageCircle className="h-5 w-5" />
    </Button>
  );
}
