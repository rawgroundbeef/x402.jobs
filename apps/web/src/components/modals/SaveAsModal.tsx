"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Copy, Loader2 } from "lucide-react";

interface SaveAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  currentName: string;
}

export function SaveAsModal({
  isOpen,
  onClose,
  onSave,
  currentName,
}: SaveAsModalProps) {
  const [name, setName] = useState(() => `${currentName} (copy)`);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedName);
      onClose();
    } catch (e) {
      console.error("Save as failed:", e);
      setError(e instanceof Error ? e.message : "Failed to save job");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setName(`${currentName} (copy)`);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            <DialogTitle>Save As</DialogTitle>
          </div>
          <DialogDescription>
            Create a copy of this job with a new name. The current job will
            remain unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="job-name"
            className="text-sm font-medium text-foreground"
          >
            Job Name
          </label>
          <Input
            id="job-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSaving) {
                handleSave();
              }
            }}
            placeholder="Enter job name"
            className="w-full"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            variant="primary"
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Save Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
