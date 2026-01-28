"use client";

import { useState, useEffect } from "react";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  AnimatedDialogDescription,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";

interface ApiKey {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  last_used_at?: string | null;
  is_active: boolean;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch API keys
  const fetchKeys = async () => {
    try {
      const res = await authenticatedFetch("/api/keys");
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      setApiKeys(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Create new key
  const handleCreate = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    try {
      const res = await authenticatedFetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDescription.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create API key");

      const data = await res.json();
      setCreatedKey(data.data.key);
      setApiKeys((prev) => [{ ...data.data, key: undefined }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke key
  const handleRevoke = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/keys/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to revoke API key");
      setApiKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, is_active: false } : k)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  // Reactivate key
  const handleReactivate = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/keys/${id}/reactivate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to reactivate API key");
      setApiKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, is_active: true } : k)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reactivate API key",
      );
    }
  };

  // Copy to clipboard
  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close create modal
  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setNewKeyName("");
    setNewKeyDescription("");
    setCreatedKey(null);
    setCopied(false);
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access.{" "}
            <Link href="/docs" className="text-primary hover:underline">
              View docs →
            </Link>
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Keys List */}
      {apiKeys.length === 0 ? (
        <Card className="p-8 text-center">
          <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No API Keys</h2>
          <p className="text-muted-foreground mb-4">
            Create an API key to start using the x402.jobs API.
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Key
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <Card
              key={key.id}
              className={`p-4 ${!key.is_active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${key.is_active ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <Key
                      className={`h-4 w-4 ${key.is_active ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{key.name}</h3>
                      {!key.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          Revoked
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created {formatDate(key.created_at)}
                      {key.last_used_at &&
                        ` · Last used ${formatDate(key.last_used_at)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {key.is_active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(key.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReactivate(key.id)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <AnimatedDialog open={isCreateOpen} onOpenChange={closeCreateModal}>
        <AnimatedDialogContent>
          <DialogHeader>
            <AnimatedDialogTitle>
              {createdKey ? "API Key Created" : "Create API Key"}
            </AnimatedDialogTitle>
            <AnimatedDialogDescription>
              {createdKey
                ? "Copy your API key now. You won't be able to see it again!"
                : "Give your API key a name to identify it later."}
            </AnimatedDialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 relative">
                <code className="text-sm font-mono break-all pr-10">
                  {createdKey}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={copyKey}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-destructive text-sm">
                  ⚠️ This key will only be shown once. Copy it now!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Name</label>
                <Input
                  placeholder="My Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Description{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  placeholder="Used for..."
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={closeCreateModal}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeCreateModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim() || isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Key"
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </div>
  );
}
