"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Shield } from "lucide-react";
import { ClaimOwnershipModal } from "@/components/modals/ClaimOwnershipModal";

interface ClaimOwnershipButtonProps {
  serverId: string;
  serverSlug: string;
  serverOriginUrl: string;
  isLoggedIn: boolean;
  ownerUsername?: string;
  onSuccess?: () => void;
}

/**
 * Reusable claim ownership button with built-in modal.
 * Shows different states:
 * - "Claim" button if not owned and user is logged in
 * - "Owned by @username" link if owned by someone
 * - Nothing if not logged in and not owned
 */
export function ClaimOwnershipButton({
  serverId,
  serverSlug,
  serverOriginUrl,
  isLoggedIn,
  ownerUsername,
  onSuccess,
}: ClaimOwnershipButtonProps) {
  const [showModal, setShowModal] = useState(false);

  // Show "Owned by @username" if server has an owner
  if (ownerUsername) {
    return (
      <Link
        href={`/@${ownerUsername}`}
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Shield className="h-4 w-4 text-primary" />
        <span>
          Owned by{" "}
          <span className="text-primary font-medium">@{ownerUsername}</span>
        </span>
      </Link>
    );
  }

  // Don't show claim button if not logged in
  if (!isLoggedIn) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowModal(true)}
        className="h-9"
      >
        <Shield className="h-4 w-4" />
        <span className="ml-1.5">Claim</span>
      </Button>

      <ClaimOwnershipModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        serverId={serverId}
        serverSlug={serverSlug}
        serverOriginUrl={serverOriginUrl}
        onSuccess={() => {
          setShowModal(false);
          onSuccess?.();
        }}
      />
    </>
  );
}
