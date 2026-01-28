"use client";

import { Button } from "@x402jobs/ui/button";
import { Search } from "lucide-react";
import { useModals } from "@/contexts/ModalContext";

/**
 * Search button that opens the global search modal.
 * The modal itself is rendered at the app layout level.
 */
export function SearchButton() {
  const { openSearch } = useModals();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => openSearch()}
      title="Search (⌘K)"
      aria-label="Search"
    >
      <Search className="h-5 w-5" />
    </Button>
  );
}
