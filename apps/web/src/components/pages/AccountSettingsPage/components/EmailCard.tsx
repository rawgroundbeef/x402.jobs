"use client";

import { useState } from "react";
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
import { Mail, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface EmailCardProps {
  email: string | undefined;
  emailConfirmedAt: string | undefined;
}

export default function EmailCard({ email, emailConfirmedAt }: EmailCardProps) {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    const trimmed = newEmail.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmed,
      });

      if (updateError) {
        if (updateError.message.includes("already registered")) {
          throw new Error(
            "This email is already associated with another account",
          );
        }
        throw new Error(updateError.message);
      }

      toast({
        title: "Verification email sent",
        description: "Check your inbox and click the link to verify.",
        variant: "success",
      });
      setIsModalOpen(false);
      setNewEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setNewEmail("");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewEmail("");
    setError("");
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Email Address</h2>
          {emailConfirmedAt && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 ml-auto">
              <CheckCircle className="h-3.5 w-3.5" /> Verified
            </span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm">
              {email || (
                <span className="text-muted-foreground">No email set</span>
              )}
            </p>
            {!emailConfirmedAt && email && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Pending verification
              </p>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Change Email Address</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Enter a new email address. We&apos;ll send a verification link.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={isSaving}
              />
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
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send Verification"
              )}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
