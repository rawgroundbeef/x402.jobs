"use client";

import { Card } from "@x402jobs/ui/card";
import { User } from "lucide-react";

interface AccountInfoCardProps {
  userId: string;
  provider: string | undefined;
  createdAt: string;
}

export default function AccountInfoCard({
  userId,
  provider,
  createdAt,
}: AccountInfoCardProps) {
  const getProviderLabel = (p: string | undefined) => {
    switch (p) {
      case "twitter":
        return "X (Twitter)";
      case "google":
        return "Google";
      default:
        return "Email/Password";
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <User className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-medium">Account Information</h2>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">User ID</span>
          <span className="font-mono text-xs">{userId}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Login Method</span>
          <span>{getProviderLabel(provider)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted-foreground">Member Since</span>
          <span>
            {new Date(createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </Card>
  );
}
