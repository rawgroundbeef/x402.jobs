"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
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
import { Trash2, AlertCircle, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function DangerZoneCard() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      const res = await authenticatedFetch("/user/account", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      await signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="p-4 border-destructive/50">
        <div className="flex items-center gap-3 mb-4">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-base font-medium text-destructive">
            Danger Zone
          </h2>
        </div>

        <div className="flex items-end justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="flex-shrink-0"
          >
            Delete Account
          </Button>
        </div>
      </Card>

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent onClose={() => {
          setIsModalOpen(false);
          setConfirmText("");
          setError("");
        }}>
          <DialogHeader>
            <AnimatedDialogTitle className="text-destructive">
              Delete Account
            </AnimatedDialogTitle>
            <AnimatedDialogDescription>
              This action is permanent and cannot be undone. All your jobs,
              wallets, and data will be deleted.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">
              To confirm, type <strong>DELETE</strong> below:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              disabled={isDeleting}
            />
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsModalOpen(false);
                setConfirmText("");
                setError("");
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== "DELETE"}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete My Account"
              )}
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
