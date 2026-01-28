"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { AlertCircle, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";

interface ClaudeConfig {
  hasApiKey: boolean;
  isEnabled: boolean;
}

export default function ClaudeCard() {
  const { data, mutate } = useSWR<ClaudeConfig>(
    "/integrations/claude/config",
    authenticatedFetcher,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const res = await authenticatedFetch("/integrations/claude/config", {
        method: "PUT",
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          isEnabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save Claude settings");
      }

      setApiKey("");
      setIsEditing(false);
      setSuccess("Claude API key saved successfully!");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-[#D97757]" />
          </div>
          <div>
            <h2 className="text-base font-medium">Claude AI</h2>
            <p className="text-sm text-muted-foreground">
              Power your prompt templates with Claude
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
          <Button variant="primary" onClick={handleStartEditing}>
            {data?.hasApiKey ? "Update" : "Configure"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="claudeApiKey">API Key</Label>
            <Input
              id="claudeApiKey"
              type="password"
              placeholder={
                data?.hasApiKey ? "Enter new key to update" : "sk-ant-api03-..."
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
              Get your API key from the{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Anthropic Console
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
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
