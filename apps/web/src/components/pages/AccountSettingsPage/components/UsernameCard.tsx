"use client";

import { useState, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { Card } from "@x402jobs/ui/card";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { useToast } from "@x402jobs/ui/toast";
import { AtSign, AlertCircle, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface UsernameCardProps {
  username: string | undefined;
  onUpdate: () => void;
}

export default function UsernameCard({
  username,
  onUpdate,
}: UsernameCardProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (username) {
      setNewUsername(username);
    }
  }, [username]);

  const validateUsername = (u: string) =>
    /^[a-z0-9_]{3,20}$/.test(u.toLowerCase());

  const handleUpdate = async () => {
    const sanitized = newUsername.toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!validateUsername(sanitized)) {
      setError(
        "Username must be 3-20 characters with letters, numbers, and underscores only",
      );
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const res = await authenticatedFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ username: sanitized }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update username");
      }

      toast({
        title: "Username updated",
        variant: "success",
      });
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update username",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setNewUsername(username || "");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewUsername(username || "");
    setError("");
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <AtSign className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Username</h2>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-sm">{username ? `@${username}` : "Not set"}</p>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Change Username</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Enter a new username for your account.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-username">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) =>
                    setNewUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder="username"
                  className="pl-7"
                  maxLength={20}
                  disabled={isSaving}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                3-20 characters. Letters, numbers, and underscores only.
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeModal} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
