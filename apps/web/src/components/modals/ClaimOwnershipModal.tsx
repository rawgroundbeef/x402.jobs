"use client";

import { useState } from "react";
import {
  AnimatedDialog,
  AnimatedDialogContent,
  DialogHeader,
  AnimatedDialogTitle,
  DialogBody,
  DialogFooter,
} from "@x402jobs/ui/dialog";
import { Button } from "@x402jobs/ui/button";
import { Input } from "@x402jobs/ui/input";
import {
  Loader2,
  Check,
  AlertCircle,
  Copy,
  Shield,
  ExternalLink,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

interface ClaimOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  serverSlug: string;
  serverOriginUrl: string;
  onSuccess: () => void;
}

type Step = "instructions" | "verifying" | "success" | "error";

export function ClaimOwnershipModal({
  isOpen,
  onClose,
  serverId,
  serverSlug,
  serverOriginUrl,
  onSuccess,
}: ClaimOwnershipModalProps) {
  const [step, setStep] = useState<Step>("instructions");
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [wellKnownUrl, setWellKnownUrl] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const res = await authenticatedFetch(`/servers/${serverId}/claim/start`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start verification");
      }

      setVerificationCode(data.verificationCode);
      setWellKnownUrl(data.wellKnownUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start verification",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    setStep("verifying");

    try {
      const res = await authenticatedFetch(
        `/servers/${serverId}/claim/verify`,
        {
          method: "POST",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setStep("success");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStep("error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopy = () => {
    if (verificationCode) {
      navigator.clipboard.writeText(`{ "x402": "${verificationCode}" }`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setStep("instructions");
    setVerificationCode(null);
    setWellKnownUrl(null);
    setError(null);
    setIsStarting(false);
    setIsVerifying(false);
    onClose();
  };

  // Success state
  if (step === "success") {
    return (
      <AnimatedDialog
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
      >
        <AnimatedDialogContent className="max-w-md" onClose={handleClose}>
          <DialogHeader>
            <AnimatedDialogTitle>Ownership Verified!</AnimatedDialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm">
            <Check className="h-4 w-4 flex-shrink-0" />
            You now own this server and all its resources.
          </div>

          <DialogFooter>
            <Button onClick={handleClose} variant="primary">
              Done
            </Button>
          </DialogFooter>
        </AnimatedDialogContent>
      </AnimatedDialog>
    );
  }

  // Build display URL
  const originHostname = (() => {
    try {
      return new URL(serverOriginUrl).hostname;
    } catch {
      return serverOriginUrl;
    }
  })();

  return (
    <AnimatedDialog
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
    >
      <AnimatedDialogContent className="max-w-lg" onClose={handleClose}>
        <DialogHeader>
          <AnimatedDialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Claim Server Ownership
          </AnimatedDialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Prove you control <strong>{serverSlug}</strong> ({originHostname})
              by adding a verification file to your server.
            </p>

            {!verificationCode ? (
              // Step 1: Generate code
              <div className="space-y-3">
                <p className="text-sm">
                  Click below to generate a unique verification code.
                </p>
                <Button
                  onClick={handleStart}
                  disabled={isStarting}
                  variant="primary"
                  className="w-full"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Verification Code"
                  )}
                </Button>
              </div>
            ) : (
              // Step 2: Show code and verify
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg space-y-3">
                  <p className="text-sm font-medium">
                    Create this file on your server:
                  </p>

                  {/* File path */}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background px-2 py-1.5 rounded border border-border truncate">
                      {wellKnownUrl}
                    </code>
                    <a
                      href={wellKnownUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* File content */}
                  <p className="text-sm font-medium">With this content:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`{ "x402": "${verificationCode}" }`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="text-sm space-y-2">
                  <p className="font-medium">Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>
                      Create the{" "}
                      <code className="bg-muted px-1 rounded">.well-known</code>{" "}
                      directory on your server
                    </li>
                    <li>
                      Add{" "}
                      <code className="bg-muted px-1 rounded">
                        x402-verification.json
                      </code>{" "}
                      with the content above
                    </li>
                    <li>Make sure it&apos;s publicly accessible</li>
                    <li>Click &quot;Verify&quot; below</li>
                  </ol>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          {verificationCode && (
            <Button
              onClick={handleVerify}
              disabled={isVerifying}
              variant="primary"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Ownership"
              )}
            </Button>
          )}
        </DialogFooter>
      </AnimatedDialogContent>
    </AnimatedDialog>
  );
}
