"use client";

import { Plus, Zap, Box, PackagePlus } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Dropdown, DropdownItem } from "@x402jobs/ui/dropdown";
import { useModals } from "@/contexts/ModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface QuickAddButtonProps {
  /** When provided, shows "Add Resource to Job" option (for canvas context) */
  onAddResourceToJob?: () => void;
}

/**
 * Self-contained quick add button with dropdown menu.
 * Allows creating jobs, registering resources, and more.
 */
export function QuickAddButton({ onAddResourceToJob }: QuickAddButtonProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { openCreateJob } = useModals();
  const isAuthenticated = !!user;

  const handleCreateJob = () => {
    if (isAuthenticated) {
      openCreateJob();
    } else {
      router.push("/login");
    }
  };

  return (
    <Dropdown
      trigger={
        <Button variant="ghost" size="icon" title="Quick Add">
          <Plus className="h-5 w-5" />
        </Button>
      }
      placement="bottom-end"
    >
      <DropdownItem variant="muted" onClick={handleCreateJob}>
        <span className="inline-flex items-center gap-2">
          <Zap className="h-3 w-3" />
          New Job
        </span>
      </DropdownItem>
      <DropdownItem variant="muted" as={Link} href={isAuthenticated ? "/dashboard/resources/new" : "/login"}>
        <span className="inline-flex items-center gap-2">
          <Box className="h-3 w-3" />
          Add Resource
        </span>
      </DropdownItem>
      {onAddResourceToJob && (
        <DropdownItem variant="muted" onClick={onAddResourceToJob}>
          <span className="inline-flex items-center gap-2">
            <PackagePlus className="h-3 w-3" />
            Add Resource to Job
          </span>
        </DropdownItem>
      )}
    </Dropdown>
  );
}
