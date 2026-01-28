"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { Card } from "@x402jobs/ui/card";
import { Badge } from "@x402jobs/ui/badge";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@x402jobs/ui/alert";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";

// Telegram icon component
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

interface TelegramConfig {
  hasBotToken: boolean;
  defaultChatId: string | null;
  isEnabled: boolean;
}

export default function TelegramCard() {
  const { data, mutate } = useSWR<TelegramConfig>(
    "/integrations/telegram/config",
    authenticatedFetcher,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [defaultChatId, setDefaultChatId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Pre-populate chat ID when entering edit mode
  const handleStartEditing = () => {
    setDefaultChatId(data?.defaultChatId || "");
    setBotToken(""); // Always start empty - user can leave blank to keep existing
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await authenticatedFetch("/integrations/telegram/config", {
        method: "PUT",
        body: JSON.stringify({
          botToken: botToken || undefined,
          defaultChatId: defaultChatId || undefined,
          isEnabled: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save Telegram settings");
      }

      setBotToken("");
      setDefaultChatId("");
      setIsEditing(false);
      setSuccess("Telegram settings saved successfully!");
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
          <TelegramIcon className="h-5 w-5 text-[#0088cc]" />
          <div>
            <h2 className="text-base font-medium">Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Post workflow outputs to Telegram
            </p>
          </div>
        </div>
        {data?.hasBotToken && <Badge variant="success">Connected</Badge>}
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
            {data?.hasBotToken ? (
              <>
                Bot configured
                {data.defaultChatId && (
                  <span className="ml-1">• Chat: {data.defaultChatId}</span>
                )}
              </>
            ) : (
              "No bot token configured"
            )}
          </div>
          <Button variant="primary" onClick={handleStartEditing}>
            {data?.hasBotToken ? "Update" : "Configure"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3 max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="botToken">Bot Token</Label>
            <Input
              id="botToken"
              type="password"
              placeholder={
                data?.hasBotToken ? "••••••••••••••••" : "123456:ABC..."
              }
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              disabled={isSaving}
            />
            {data?.hasBotToken && (
              <p className="text-xs text-muted-foreground">
                Leave blank to keep your existing token
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="chatId">Default Chat ID</Label>
            <Input
              id="chatId"
              placeholder="@channel or numeric id"
              value={defaultChatId}
              onChange={(e) => setDefaultChatId(e.target.value)}
              disabled={isSaving}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setBotToken("");
                setDefaultChatId("");
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
