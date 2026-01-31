"use client";

import Link from "next/link";
import { Button } from "@x402jobs/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
}: AddResourceModalButtonProps) {
  const { user } = useAuth();

  const href = user ? "/dashboard/resources/new" : "/login";

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      as={Link}
      href={href}
      onClick={onClick}
    >
      {showIcon && <Plus className="h-4 w-4" />}
      {label}
    </Button>
  );
}
