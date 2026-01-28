"use client";

import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";

interface AddResourceModalButtonProps {
  variant?: "ghost" | "outline" | "default" | "primary";
  size?: "sm" | "default" | "lg" | "icon";
  showIcon?: boolean;
  className?: string;
  label?: string;
  /** Called after opening the modal (useful for closing parent modals) */
  onClick?: () => void;
  /** Called after successfully creating a resource */
  onSuccess?: () => void;
}

export function AddResourceModalButton({
  variant = "ghost",
  size = "default",
  showIcon = true,
  className,
  label = "Add Resource",
  onClick,
  onSuccess,
}: AddResourceModalButtonProps) {
  const { user } = useAuth();
  const { openRegisterResource } = useModals();

  const handleClick = () => {
    openRegisterResource(onSuccess);
    onClick?.();
  };

  if (!user) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        as={Link}
        href="/login"
      >
        {showIcon && <Plus className="h-4 w-4" />}
        {label}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      {showIcon && <Plus className="h-4 w-4" />}
      {label}
    </Button>
  );
}
