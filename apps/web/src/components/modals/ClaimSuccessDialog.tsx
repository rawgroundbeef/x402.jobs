"use client";

import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import Link from "next/link";

interface ClaimSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amountClaimed: string;
  platformWallet?: string;
  txSignature?: string;
  isDryRun?: boolean;
}

export function ClaimSuccessDialog({
  isOpen,
  onClose,
  amountClaimed,
  platformWallet,
  txSignature,
  isDryRun,
}: ClaimSuccessDialogProps) {
  const fireConfetti = useCallback(() => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    // Brand colors: teal, blue, purple
    const colors = [
      "#14B8A6",
      "#2DD4BF",
      "#5EEAD4", // Teal
      "#3B82F6",
      "#60A5FA",
      "#93C5FD", // Blue
      "#8B5CF6",
      "#A78BFA",
      "#C4B5FD", // Purple
    ];

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.2, y: 0.7 },
      colors,
    });
    fire(0.2, {
      spread: 60,
      origin: { x: 0.5, y: 0.7 },
      colors,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      origin: { x: 0.8, y: 0.7 },
      colors,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      origin: { x: 0.5, y: 0.6 },
      colors,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      origin: { x: 0.5, y: 0.7 },
      colors,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Fire confetti!
      fireConfetti();

      // Fire again for more celebration
      const timeout = setTimeout(() => {
        fireConfetti();
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [isOpen, fireConfetti]);

  const shortWallet = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Emoji */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className="text-7xl mb-4"
            >
              💰
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold font-display text-foreground mb-2"
            >
              Rewards Claimed!
            </motion.h2>

            {/* Amount */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2 mb-6"
            >
              <p className="text-muted-foreground text-sm">You received</p>
              <p className="text-5xl font-bold font-display bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] bg-clip-text text-transparent">
                {formatAmount(amountClaimed)}
              </p>
              <p className="text-sm text-muted-foreground">USDC</p>
            </motion.div>

            {/* Platform wallet info */}
            {platformWallet && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mb-6 p-4 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                  <Wallet className="w-4 h-4" />
                  <span className="text-xs">Added to your platform wallet</span>
                </div>
                <p className="font-mono text-sm text-foreground">
                  {shortWallet(platformWallet)}
                </p>
              </motion.div>
            )}

            {/* Dry run warning */}
            {isDryRun && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <p className="text-xs text-amber-700">
                  🧪 <strong>DRY RUN</strong> - No actual transfer was made
                </p>
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col gap-3"
            >
              {/* CTA to wallet page - primary action */}
              <Link href="/dashboard/wallet" onClick={onClose}>
                <Button
                  size="lg"
                  className="w-full text-white bg-gradient-to-r from-[#10b981] via-[#14b8a6] to-[#06b6d4] hover:from-[#059669] hover:via-[#0d9488] hover:to-[#0891b2]"
                >
                  View in Wallet
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>

              {/* Share on X */}
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `Just got paid for holding $JOBS 💰\n\n50% of platform fees. Paid monthly in USDC.\n\nhttps://x402.jobs/rewards`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full">
                  <svg
                    className="w-4 h-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Share on X
                </Button>
              </a>

              {/* Transaction link */}
              {txSignature && !isDryRun && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View on Solscan
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
