"use client";

import { Button } from "@x402jobs/ui/button";
import { FolderOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";

/**
 * Button to open the My Jobs sidebar.
 * Only visible when user is authenticated.
 */
export function MyJobsButton() {
  const { user } = useAuth();
  const { openMyJobs } = useModals();

  if (!user) return null;

  return (
    <Button variant="ghost" size="sm" onClick={openMyJobs} className="gap-1.5">
      <FolderOpen className="h-4 w-4" />
      <span className="hidden sm:inline">My Jobs</span>
    </Button>
  );
}
