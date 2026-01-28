"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";
import { Button } from "@x402jobs/ui/button";
import { Check, ArrowRight, Play, Monitor } from "lucide-react";
import { motion } from "framer-motion";

// Flow diagram node component
function FlowNode({
  children,
  delay = 0,
  variant = "default",
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "trigger" | "resource" | "output" | "default";
}) {
  const variants = {
    trigger:
      "bg-neutral-100 dark:bg-neutral-900/90 border-emerald-500/50 shadow-lg shadow-emerald-500/10",
    resource:
      "bg-neutral-100 dark:bg-neutral-900/90 border-teal-500/50 shadow-lg shadow-teal-500/10",
    output:
      "bg-neutral-100 dark:bg-neutral-900/90 border-violet-500/50 shadow-lg shadow-violet-500/10",
    default: "bg-card border-border",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-xl border-2 px-4 py-3 ${variants[variant]}`}
    >
      {children}
    </motion.div>
  );
}

// Connecting line between nodes
function ConnectingLine({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.3, delay }}
      className="flex flex-col items-center py-1 origin-top"
    >
      <div className="w-0.5 h-5 bg-gradient-to-b from-neutral-400/60 to-neutral-400/30 dark:from-neutral-500/50 dark:to-neutral-500/20" />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-neutral-400/60 dark:border-t-neutral-500/50" />
    </motion.div>
  );
}

// Dot grid background pattern - neutral, supports light/dark mode
function DotGridBackground() {
  return (
    <>
      {/* Light mode */}
      <div
        className="absolute inset-0 rounded-2xl dark:hidden"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Dark mode */}
      <div
        className="absolute inset-0 rounded-2xl hidden dark:block"
        style={{
          backgroundColor: "#1a1a1a",
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </>
  );
}

export function WorkflowShowcase() {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { openCreateJob } = useModals();

  const handleCreateJob = () => {
    if (isAuthenticated) {
      openCreateJob();
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
      {/* Left Side - Copy */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center lg:text-left"
      >
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6">
          Build Jobs That{" "}
          <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-violet-500 bg-clip-text text-transparent whitespace-nowrap">
            Pay You
          </span>
        </h2>

        <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto lg:mx-0">
          Chain x402 resources visually. Set your markup. Publish as an
          endpoint. Earn on every run.
        </p>

        <ul className="space-y-3 mb-8 inline-block text-left">
          {[
            "Drag and drop resources",
            "Set your own price on top",
            "One-click publish to x402",
          ].map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 text-foreground"
            >
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="h-3 w-3 text-emerald-600" />
              </div>
              {item}
            </motion.li>
          ))}
        </ul>

        <div>
          <Button
            size="lg"
            onClick={handleCreateJob}
            className="w-full sm:w-auto text-white border-0 transition-transform duration-200 ease-out hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #10b981, #06b6d4, #8b5cf6)",
            }}
          >
            Create Your First Job
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </motion.div>

      {/* Right Side - Flow Diagram */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        <div className="rounded-2xl p-6 md:p-8 shadow-2xl border border-black/10 dark:border-white/10 relative overflow-hidden bg-white dark:bg-[#1a1a1a]">
          {/* Grid background */}
          <DotGridBackground />

          <div className="relative flex flex-col items-center">
            {/* Trigger Node */}
            <FlowNode variant="trigger" delay={0.3}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Play className="h-4 w-4 text-emerald-500 fill-emerald-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    Trigger
                  </div>
                  <div className="text-xs text-neutral-500">
                    Webhook / Schedule
                  </div>
                </div>
              </div>
            </FlowNode>

            <ConnectingLine delay={0.45} />

            {/* Resource Node 1 - Enhance Prompt */}
            <FlowNode variant="resource" delay={0.5}>
              <div className="flex items-center justify-between gap-6 min-w-[240px]">
                <div className="flex items-center gap-3">
                  <div className="text-xl">🤖</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      memeputer/enhance-prompt
                    </div>
                    <div className="text-xs text-neutral-500">
                      Prompt Enhancement
                    </div>
                  </div>
                </div>
                <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                  $0.01
                </div>
              </div>
            </FlowNode>

            <ConnectingLine delay={0.65} />

            {/* Resource Node 2 - PFPputer */}
            <FlowNode variant="resource" delay={0.7}>
              <div className="flex items-center justify-between gap-6 min-w-[240px]">
                <div className="flex items-center gap-3">
                  <div className="text-xl">🎨</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      memeputer/pfpputer
                    </div>
                    <div className="text-xs text-neutral-500">
                      AI Image Generation
                    </div>
                  </div>
                </div>
                <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                  $0.10
                </div>
              </div>
            </FlowNode>

            <ConnectingLine delay={0.85} />

            {/* Resource Node 3 - VEOputer */}
            <FlowNode variant="resource" delay={0.9}>
              <div className="flex items-center justify-between gap-6 min-w-[240px]">
                <div className="flex items-center gap-3">
                  <div className="text-xl">🎬</div>
                  <div>
                    <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      memeputer/veoputer
                    </div>
                    <div className="text-xs text-neutral-500">
                      AI Video Generation
                    </div>
                  </div>
                </div>
                <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                  $2.50
                </div>
              </div>
            </FlowNode>

            <ConnectingLine delay={1.05} />

            {/* Output Node */}
            <FlowNode variant="output" delay={1.1}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Monitor className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    Output
                  </div>
                  <div className="text-xs text-neutral-500">Video file</div>
                </div>
              </div>
            </FlowNode>

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.3 }}
              className="w-full mt-6 pt-6 border-t border-black/10 dark:border-white/10"
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-neutral-500 mb-1">
                    Total per run
                  </div>
                  <div className="text-sm font-mono text-neutral-700 dark:text-neutral-300">
                    $2.61 USDC
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">
                    Your markup
                  </div>
                  <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400">
                    +$0.39
                  </div>
                </div>
                <div>
                  <div className="text-xs text-neutral-500 mb-1">You earn</div>
                  <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    $0.39/run
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
