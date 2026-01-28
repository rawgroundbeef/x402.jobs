"use client";

import { useState } from "react";
import { Button } from "@x402jobs/ui/button";
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
import {
  Key,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface WalletKeys {
  solana: {
    address: string;
    privateKey: string;
  };
  base?: {
    address: string;
    privateKey: string;
  };
}

interface PrivateKeyCardProps {
  inline?: boolean;
}

export default function PrivateKeyCard({
  inline = false,
}: PrivateKeyCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [keys, setKeys] = useState<WalletKeys | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSolanaKey, setShowSolanaKey] = useState(false);
  const [showBaseKey, setShowBaseKey] = useState(false);
  const [copiedSolana, setCopiedSolana] = useState(false);
  const [copiedBase, setCopiedBase] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await authenticatedFetch("/wallet/export-key");

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to export keys");
      }

      const data = await res.json();
      setKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export keys");
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = () => {
    setKeys(null);
    setError("");
    setShowSolanaKey(false);
    setShowBaseKey(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setKeys(null);
    setShowSolanaKey(false);
    setShowBaseKey(false);
  };

  const copySolanaKey = async () => {
    if (!keys) return;
    await navigator.clipboard.writeText(keys.solana.privateKey);
    setCopiedSolana(true);
    setTimeout(() => setCopiedSolana(false), 2000);
  };

  const copyBaseKey = async () => {
    if (!keys?.base) return;
    await navigator.clipboard.writeText(keys.base.privateKey);
    setCopiedBase(true);
    setTimeout(() => setCopiedBase(false), 2000);
  };

  const trigger = inline ? (
    <button
      onClick={openModal}
      className="flex items-center justify-between w-full py-3 px-4 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
    >
      <span className="flex items-center gap-2">
        <Key className="h-4 w-4" />
        Export private keys
      </span>
      <span className="text-xs px-2 py-1 rounded bg-muted">Export</span>
    </button>
  ) : (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Key className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-medium">Private Keys</h2>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-sm text-muted-foreground">
          Export your wallet private keys
        </p>
        <Button variant="primary" size="sm" onClick={openModal}>
          Export
        </Button>
      </div>
    </Card>
  );

  return (
    <>
      {trigger}

      <AnimatedDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <AnimatedDialogContent className="max-w-lg" onClose={closeModal}>
          <DialogHeader>
            <AnimatedDialogTitle>Export Private Keys</AnimatedDialogTitle>
            <AnimatedDialogDescription>
              Your private keys give full access to your wallets. Never share
              them with anyone.
            </AnimatedDialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {keys && (
              <div className="space-y-4">
                {/* Solana Key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Solana Wallet</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSolanaKey(!showSolanaKey)}
                        className="h-7 px-2"
                      >
                        {showSolanaKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copySolanaKey}
                        className="h-7 px-2"
                      >
                        {copiedSolana ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {keys.solana.address}
                  </p>
                  {showSolanaKey && (
                    <pre className="p-2 bg-muted rounded text-xs font-mono overflow-x-auto break-all whitespace-pre-wrap">
                      {keys.solana.privateKey}
                    </pre>
                  )}
                </div>

                {/* Base Key */}
                {keys.base && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Base Wallet</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBaseKey(!showBaseKey)}
                          className="h-7 px-2"
                        >
                          {showBaseKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyBaseKey}
                          className="h-7 px-2"
                        >
                          {copiedBase ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {keys.base.address}
                    </p>
                    {showBaseKey && (
                      <pre className="p-2 bg-muted rounded text-xs font-mono overflow-x-auto break-all whitespace-pre-wrap">
                        {keys.base.privateKey}
                      </pre>
                    )}
                  </div>
                )}

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Never share your private keys. Anyone with access can steal
                    your funds.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            {!keys && (
              <Button
                variant="destructive"
                onClick={handleExport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  "Reveal Private Keys"
                )}
              </Button>
            )}
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    </>
  );
}
