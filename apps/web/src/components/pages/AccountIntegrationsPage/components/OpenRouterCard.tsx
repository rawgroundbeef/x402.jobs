"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { AlertCircle, CheckCircle, Loader2, Network } from "lucide-react";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";

interface OpenRouterConfig {
  hasApiKey: boolean;
  isEnabled: boolean;
}

export default function OpenRouterCard() {
  const { data, mutate } = useSWR<OpenRouterConfig>(
    "/integrations/openrouter/config",
    authenticatedFetcher,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [affectedCount, setAffectedCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Start editing mode
  const handleStartEditing = () => {
    setApiKey(""); // Always start empty - user can leave blank to keep existing
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await authenticatedFetch("/integrations/openrouter/config", {
        method: "PUT",
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          isEnabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save OpenRouter settings");
      }

      setApiKey("");
      setIsEditing(false);
      setSuccess("OpenRouter API key saved successfully!");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete button click - fetch affected count first
  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(
        "/integrations/openrouter/affected-resources",
      );
      if (res.ok) {
        const data = await res.json();
        setAffectedCount(data.count || 0);
      }
      setShowDeleteConfirm(true);
    } catch (err) {
      console.error("Failed to fetch affected resources", err);
      // Still show dialog even if count fetch fails
      setAffectedCount(0);
      setShowDeleteConfirm(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle confirmed delete
  const handleConfirmedDelete = async () => {
    try {
      const res = await authenticatedFetch("/integrations/openrouter/config", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete OpenRouter integration");
      }

      mutate();
      setShowDeleteConfirm(false);
      setAffectedCount(0);
      setSuccess("OpenRouter integration removed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete OpenRouter integration",
      );
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 flex items-center justify-center">
              <Network className="h-5 w-5 text-[#6366F1]" />
            </div>
            <div>
              <h2 className="text-base font-medium">OpenRouter</h2>
              <p className="text-sm text-muted-foreground">
                Access 200+ AI models with one API key
              </p>
            </div>
          </div>
          {data?.hasApiKey && <Badge variant="success">Connected</Badge>}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {!isEditing ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data?.hasApiKey ? "API key configured" : "No API key configured"}
            </div>
            <div className="flex gap-2">
              {data?.hasApiKey && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Delete Integration"
                  )}
                </Button>
              )}
              <Button variant="primary" onClick={handleStartEditing}>
                {data?.hasApiKey ? "Update" : "Configure"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="openrouterApiKey">API Key</Label>
              <Input
                id="openrouterApiKey"
                type="password"
                placeholder={
                  data?.hasApiKey ? "Enter new key to update" : "sk-or-v1-..."
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isSaving}
                className="font-mono text-sm"
              />
              {data?.hasApiKey && (
                <p className="text-xs text-muted-foreground">
                  Leave blank to keep your existing key
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                </a>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setApiKey("");
                  setError("");
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OpenRouter Integration?</DialogTitle>
            <DialogDescription>
              {affectedCount > 0
                ? `You have ${affectedCount} resource(s) using this key. They will stop working.`
                : "This will remove your OpenRouter API key."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmedDelete}>
              Delete Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
