"use client";

import { useState, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
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
import { FileText, AlertCircle, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface BioCardProps {
  bio: string | undefined;
  onUpdate: () => void;
}

export default function BioCard({ bio, onUpdate }: BioCardProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const MAX_BIO_LENGTH = 500;

  useEffect(() => {
    if (bio) {
      setNewBio(bio);
    }
  }, [bio]);

  const handleUpdate = async () => {
    const trimmed = newBio.trim();

    if (trimmed.length > MAX_BIO_LENGTH) {
      setError(`Bio must be ${MAX_BIO_LENGTH} characters or less`);
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const res = await authenticatedFetch("/user/profile", {
        method: "PUT",
        body: JSON.stringify({ bio: trimmed || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update bio");
      }

      toast({
        title: "Bio updated",
        variant: "success",
      });
      setIsModalOpen(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update bio");
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setNewBio(bio || "");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewBio(bio || "");
    setError("");
  };

  const truncateBio = (text: string | undefined, maxLength: number) => {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Bio</h2>
        </div>

        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground flex-1">
            {truncateBio(bio, 100) || "No bio set"}
          </p>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Edit Bio</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Write a short bio to tell others about yourself.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-bio">Bio</Label>
              <textarea
                id="new-bio"
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                placeholder="Tell others about yourself..."
                maxLength={MAX_BIO_LENGTH}
                disabled={isSaving}
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Shown on your public profile.</span>
                <span
                  className={
                    newBio.length > MAX_BIO_LENGTH ? "text-destructive" : ""
                  }
                >
                  {newBio.length}/{MAX_BIO_LENGTH}
                </span>
              </div>
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
              disabled={isSaving || newBio.length > MAX_BIO_LENGTH}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
