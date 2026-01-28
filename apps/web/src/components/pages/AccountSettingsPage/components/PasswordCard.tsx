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
import { Lock, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PasswordCard() {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (!newPassword.trim()) {
      setError("Please enter a password");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      toast({
        title: "Password updated",
        variant: "success",
      });
      setIsModalOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update password",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openModal = () => {
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-base font-medium">Password</h2>
        </div>

        <div className="flex items-end justify-between">
          <p className="text-sm text-muted-foreground">••••••••</p>
          <Button variant="primary" size="sm" onClick={openModal}>
            Change
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Change Password</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Enter a new password for your account.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isSaving}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Password must be at least 6 characters.
            </p>

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
                "Update Password"
              )}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
