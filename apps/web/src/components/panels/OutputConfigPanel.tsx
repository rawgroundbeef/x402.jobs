"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Monitor,
  Send,
  Square,
  CheckSquare,
  ArrowDownToLine,
  ExternalLink,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import { Label } from "@x402jobs/ui/label";
import { SlidePanel } from "./SlidePanel";
import { DrawerHeaderAvatar } from "./DrawerHeaderAvatar";
import { useToast } from "@x402jobs/ui/toast";
import { useWallet } from "@/hooks/useWallet";

// X icon component
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// x402.storage icon (cardboard box)
function X402StorageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 222 222" className={className} fill="none">
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06L43.96 158.76V92.16L110.56 125.46Z"
        fill="#8B7355"
      />
      <path
        d="M43.96 92.16L110.56 125.46V192.06L43.96 158.76V92.16Z"
        fill="#7A6345"
      />
      <path
        d="M110.56 125.46L177.16 92.16V158.76L110.56 192.06V125.46Z"
        fill="#6B5344"
      />
      <path
        d="M43.96 92.16L110.56 61.08L177.16 92.16L110.56 125.46L43.96 92.16Z"
        fill="#A08060"
      />
      <path
        d="M43.96 92.16L110.56 61.08L79.48 30L4 65.52L43.96 92.16Z"
        fill="#C4A77D"
      />
      <path
        d="M177.16 92.16L110.56 61.08L141.64 30L217.12 65.52L177.16 92.16Z"
        fill="#B8956F"
      />
    </svg>
  );
}

export interface OutputDestination {
  type: "app" | "telegram" | "x" | "x402storage";
  enabled: boolean;
  config?: {
    chatId?: string;
    imageField?: string;
    captionField?: string;
  };
}

export interface OutputConfigPanelConfig {
  destinations: OutputDestination[];
}

interface TelegramStatus {
  connected: boolean;
  defaultChatId?: string;
}

interface XStatus {
  connected: boolean;
  profile?: {
    username?: string;
  };
}

interface OutputConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: OutputConfigPanelConfig) => void;
  currentConfig?: OutputConfigPanelConfig;
  telegramStatus?: TelegramStatus;
  xStatus?: XStatus;
  /** Stack level for z-index ordering */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? */
  hasStackedChild?: boolean;
}

export function OutputConfigPanel({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  telegramStatus,
  xStatus,
  stackLevel = 1,
  hasStackedChild = false,
}: OutputConfigPanelProps) {
  const { toast } = useToast();
  const wasOpenRef = useRef(false);
  const { wallet } = useWallet();
  const hasStorageBalance = (wallet?.totalBalanceUsdc || 0) >= 0.01;

  // Local state
  const [destinations, setDestinations] = useState<OutputDestination[]>(
    currentConfig?.destinations || [{ type: "app", enabled: true }],
  );
  const [telegramImageField, setTelegramImageField] = useState("");
  const [telegramCaptionField, setTelegramCaptionField] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [xImageField, setXImageField] = useState("");
  const [xCaptionField, setXCaptionField] = useState("");

  const hasTelegram = telegramStatus?.connected || false;
  const hasX = xStatus?.connected || false;

  // Reset form when panel opens
  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      if (currentConfig) {
        setDestinations(
          currentConfig.destinations || [{ type: "app", enabled: true }],
        );

        // Load telegram config
        const telegramDest = currentConfig.destinations?.find(
          (d) => d.type === "telegram",
        );
        if (telegramDest?.config) {
          setTelegramImageField(telegramDest.config.imageField || "");
          setTelegramCaptionField(telegramDest.config.captionField || "");
          setTelegramChatId(telegramDest.config.chatId || "");
        } else {
          setTelegramImageField("");
          setTelegramCaptionField("");
          setTelegramChatId("");
        }

        // Load X config
        const xDest = currentConfig.destinations?.find((d) => d.type === "x");
        if (xDest?.config) {
          setXImageField(xDest.config.imageField || "");
          setXCaptionField(xDest.config.captionField || "");
        } else {
          setXImageField("");
          setXCaptionField("");
        }
      } else {
        // Reset to defaults when no config exists
        setDestinations([{ type: "app", enabled: true }]);
        setTelegramImageField("");
        setTelegramCaptionField("");
        setTelegramChatId("");
        setXImageField("");
        setXCaptionField("");
      }
    }
  }, [isOpen, currentConfig]);

  const isDestinationEnabled = (type: OutputDestination["type"]) => {
    return destinations.some((d) => d.type === type && d.enabled);
  };

  const toggleDestination = (type: OutputDestination["type"]) => {
    setDestinations((prev) => {
      const existing = prev.find((d) => d.type === type);
      if (existing) {
        return prev.map((d) =>
          d.type === type ? { ...d, enabled: !d.enabled } : d,
        );
      }
      return [...prev, { type, enabled: true }];
    });
  };

  const handleSave = () => {
    // Build destinations with configs
    const updatedDestinations = destinations.map((d) => {
      if (d.type === "telegram" && d.enabled) {
        return {
          ...d,
          config: {
            imageField: telegramImageField || undefined,
            captionField: telegramCaptionField || undefined,
            chatId: telegramChatId || undefined,
          },
        };
      }
      if (d.type === "x" && d.enabled) {
        return {
          ...d,
          config: {
            imageField: xImageField || undefined,
            captionField: xCaptionField || undefined,
          },
        };
      }
      return d;
    });

    onSave({ destinations: updatedDestinations });
    toast({
      title: "Output configuration saved",
      variant: "success",
    });
  };

  const headerAvatar = (
    <DrawerHeaderAvatar
      fallbackIcon={<ArrowDownToLine className="h-8 w-8 text-output" />}
      fallbackClassName="bg-output/20"
    />
  );

  return (
    <SlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-start gap-4 py-1 pr-6">
          {headerAvatar}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="font-semibold text-foreground text-lg">
              Configure Output
            </div>
            <p className="text-sm text-muted-foreground/80 mt-1 font-normal">
              Where to send job results
            </p>
          </div>
        </div>
      }
      stackLevel={stackLevel}
      hasStackedChild={hasStackedChild}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-output hover:bg-output/90 text-white"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose where to send job outputs. You can enable multiple
          destinations.
        </p>

        {/* In-App */}
        <button
          onClick={() => toggleDestination("app")}
          className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
            isDestinationEnabled("app")
              ? "border-output bg-output/5"
              : "border-border hover:border-output/50"
          }`}
        >
          {isDestinationEnabled("app") ? (
            <CheckSquare className="h-5 w-5 text-output shrink-0 mt-0.5" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="h-4 w-4 text-output" />
              <span className="font-medium">In-App</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Display output in the canvas (always recommended)
            </p>
          </div>
        </button>

        {/* Telegram */}
        <div
          className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
            !hasTelegram
              ? "border-border/50 opacity-60"
              : isDestinationEnabled("telegram")
                ? "border-output bg-output/5"
                : "border-border hover:border-output/50"
          }`}
        >
          <button
            onClick={() => hasTelegram && toggleDestination("telegram")}
            disabled={!hasTelegram}
            className="flex items-start gap-3 flex-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDestinationEnabled("telegram") && hasTelegram ? (
              <CheckSquare className="h-5 w-5 text-output shrink-0 mt-0.5" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <Send className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Telegram</span>
                {!hasTelegram && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    Not configured
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasTelegram
                  ? `Send to Telegram (default: ${telegramStatus?.defaultChatId || "not set"})`
                  : "Configure in Dashboard → Integrations"}
              </p>
            </div>
          </button>
          {!hasTelegram && (
            <Link
              href="/dashboard/integrations"
              className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
            >
              Configure
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Telegram Settings */}
        {isDestinationEnabled("telegram") && hasTelegram && (
          <div className="ml-8 pl-4 border-l-2 border-output/20 space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Image Field</Label>
                <Input
                  placeholder="imageUrl"
                  value={telegramImageField}
                  onChange={(e) => setTelegramImageField(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Caption Field</Label>
                <Input
                  placeholder="captions"
                  value={telegramCaptionField}
                  onChange={(e) => setTelegramCaptionField(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Chat ID (optional)</Label>
              <Input
                placeholder={
                  telegramStatus?.defaultChatId || "@channel or -123456"
                }
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* X */}
        <div
          className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
            !hasX
              ? "border-border/50 opacity-60"
              : isDestinationEnabled("x")
                ? "border-output bg-output/5"
                : "border-border hover:border-output/50"
          }`}
        >
          <button
            onClick={() => hasX && toggleDestination("x")}
            disabled={!hasX}
            className="flex items-start gap-3 flex-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDestinationEnabled("x") && hasX ? (
              <CheckSquare className="h-5 w-5 text-output shrink-0 mt-0.5" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <XIcon className="h-4 w-4" />
                <span className="font-medium">X (Twitter)</span>
                {!hasX && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {hasX
                  ? `Post as @${xStatus?.profile?.username || "connected"}`
                  : "Connect in Dashboard → Integrations"}
              </p>
            </div>
          </button>
          {!hasX && (
            <Link
              href="/dashboard/integrations"
              className="shrink-0 text-xs text-primary hover:underline flex items-center gap-1"
            >
              Connect
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* X Settings */}
        {isDestinationEnabled("x") && hasX && (
          <div className="ml-8 pl-4 border-l-2 border-output/20 space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Image Field</Label>
                <Input
                  placeholder="imageUrl"
                  value={xImageField}
                  onChange={(e) => setXImageField(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Caption Field</Label>
                <Input
                  placeholder="captions"
                  value={xCaptionField}
                  onChange={(e) => setXCaptionField(e.target.value)}
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* x402.storage */}
        <div
          className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-start gap-3 ${
            !hasStorageBalance
              ? "border-border/50 opacity-60"
              : isDestinationEnabled("x402storage")
                ? "border-output bg-output/5"
                : "border-border hover:border-output/50"
          }`}
        >
          <button
            onClick={() =>
              hasStorageBalance && toggleDestination("x402storage")
            }
            disabled={!hasStorageBalance}
            className="flex items-start gap-3 flex-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {isDestinationEnabled("x402storage") && hasStorageBalance ? (
              <CheckSquare className="h-5 w-5 text-output shrink-0 mt-0.5" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <X402StorageIcon className="h-4 w-4" />
                <span className="font-medium">x402.storage</span>
                {!hasStorageBalance && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    Low balance
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                +$0.01 · Permanent link
              </p>
            </div>
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}
