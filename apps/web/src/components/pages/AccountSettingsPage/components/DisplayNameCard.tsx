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
import { User, AlertCircle, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface DisplayNameCardProps {
  displayName: string | undefined;
  onUpdate: () => void;
}

export default function DisplayNameCard({
  displayName,
  onUpdate,
}: DisplayNameCardProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (displayName) {
      setNewDisplayName(displayName);
    }
  }, [displayName]);

  const handleUpdate = async () => {
    const trimmed = newDisplayName.trim();

    if (trimmed.length > 50) {
      setError("Display name must be 50 characters or less");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const res = await authenticatedFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update display name");
      }

      toast({
        title: "Display name updated",
        variant: "success",
      });
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update display name",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setNewDisplayName(displayName || "");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewDisplayName(displayName || "");
    setError("");
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Display Name</h2>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-sm">{displayName || "Not set"}</p>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Change Display Name</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              This is the name shown on your public profile.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-display-name">Display Name</Label>
              <Input
                id="new-display-name"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Up to 50 characters.
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
