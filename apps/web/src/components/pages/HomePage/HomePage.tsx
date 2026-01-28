"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useModals } from "@/contexts/ModalContext";
import BaseLayout from "@/components/BaseLayout";
import { PlatformStats } from "@/components/PlatformStats";
import { WorkflowShowcase } from "@/components/WorkflowShowcase";
import { ExploreSection } from "@/components/ExploreSection";
import { DashboardPreviewSection } from "@/components/DashboardPreviewSection";
import { DiscoverSection } from "@/components/DiscoverSection";
import { CreateJobModal } from "@/components/modals/CreateJobModal";
import { CreateWorkflowDialog } from "@/components/modals/CreateWorkflowDialog";
import { ChatInput } from "@x402jobs/ui/chat-input";
import { ChainIcon } from "@/components/icons/ChainIcons";
import type { NetworkType } from "@/hooks/useWorkflowPersistence";
import { authenticatedFetch } from "@/lib/api";
import { Button } from "@x402jobs/ui/button";
import { Loader2 } from "lucide-react";
import { BackgroundBlotches } from "./components/BackgroundBlotches";
import { motion } from "framer-motion";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const { isCreateJobOpen, openCreateJob, closeCreateJob } = useModals();
  const [prompt, setPrompt] = useState("");
  const [network, setNetwork] = useState<NetworkType>("solana");
  const [isMobile, setIsMobile] = useState(true);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [workflowDialogPrompt, setWorkflowDialogPrompt] = useState("");

  // Check screen size for responsive placeholder
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle creating a blank job
  const handleCreateJob = async (name: string, network: NetworkType) => {
    try {
      const res = await authenticatedFetch("/jobs", {
        method: "POST",
        body: JSON.stringify({
          name,
          network,
          workflow_data: { nodes: [], edges: [] },
        }),
      });
      const data = await res.json();
      if (data.job?.id) {
        router.push(`/jobs/${data.job.id}`);
      }
    } catch (e) {
      console.error("Failed to create job:", e);
    }
  };

  // Handle prompt submission - open the workflow dialog
  const handlePromptSubmit = () => {
    if (!prompt.trim()) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    // Open the workflow dialog with the prompt
    setWorkflowDialogPrompt(prompt.trim());
    setIsWorkflowDialogOpen(true);
    setPrompt(""); // Clear the input
  };

  // Handle closing the workflow dialog
  const handleCloseWorkflowDialog = () => {
    setIsWorkflowDialogOpen(false);
    setWorkflowDialogPrompt("");
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <BaseLayout maxWidth="max-w-screen-2xl" showJobsFooter>
      <BackgroundBlotches />

      {/* Main Content */}
      <main className="w-full py-20 md:py-36">
        {/* Hero Section */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5 }}
          className="text-center mb-28"
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl tracking-tight mb-4 md:mb-8 font-bold">
            Where x402 Works
          </h1>
          <p className="text-lg md:text-2xl text-muted-foreground mb-8 font-medium max-w-2xl mx-auto">
            Build x402 workflows. Get paid. Discover what works.
          </p>

          {/* Action Buttons - ABOVE input */}
          <div className="my-8 md:my-12 grid md:grid-cols-3 gap-3 md:gap-4 md:max-w-xl mx-auto">
            <Button
              size="lg"
              variant="secondary"
              className="px-4 md:px-8 transition-transform duration-200 ease-out hover:scale-[1.02]"
              asChild
            >
              <Link href="/jobs">Browse</Link>
            </Button>
            <Button
              size="lg"
              className="px-4 md:px-8 text-white border-0 transition-transform duration-200 ease-out hover:scale-[1.02]"
              style={{
                background:
                  "linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #8b5cf6)",
              }}
              onClick={() => {
                if (isAuthenticated) {
                  openCreateJob();
                } else {
                  router.push("/login");
                }
              }}
            >
              Create
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="px-4 md:px-8 transition-transform duration-200 ease-out hover:scale-[1.02]"
              asChild
            >
              <Link href="/developers">API</Link>
            </Button>
          </div>

          {/* AI Job Creation - Production style */}
          <div className="max-w-3xl mx-auto my-10 md:my-14">
            <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Describe what you want to build
            </p>
            <ChatInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={handlePromptSubmit}
              placeholder={
                isMobile
                  ? "Describe your workflow..."
                  : "e.g., Summarize a YouTube video and post it to Telegram"
              }
              isLoading={false}
              disabled={false}
              gradientBorder
              className="shadow-xl shadow-primary/10 [&_textarea]:text-base [&_textarea]:py-4 [&_textarea]:min-h-[56px] [&_button]:h-10 [&_button]:w-10 [&_button_svg]:h-5 [&_button_svg]:w-5"
              leftAdornments={
                <button
                  type="button"
                  onClick={() =>
                    setNetwork(network === "solana" ? "base" : "solana")
                  }
                  className={`p-1.5 rounded-lg transition-colors hover:bg-muted ${
                    network === "base" ? "text-blue-500" : "text-purple-500"
                  }`}
                  title={`${network === "base" ? "Base" : "Solana"} • Click to switch`}
                >
                  <ChainIcon network={network} className="w-5 h-5" />
                </button>
              }
            />

            {/* Example prompts */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                "Book a flight JFK → Bali, Jan 10-17",
                "Generate an image and turn it into a video",
                "Generate a profile picture from a CA",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    if (!isAuthenticated) {
                      router.push("/login");
                      return;
                    }
                    setWorkflowDialogPrompt(example);
                    setIsWorkflowDialogOpen(true);
                  }}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted border border-border/50 rounded-full transition-all hover:scale-[1.02]"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Stats - inside hero section */}
          <div className="mt-12 md:mt-16">
            <PlatformStats />
          </div>
        </motion.div>

        {/* Spacer before next section */}
        <div className="mb-32 md:mb-40"></div>

        {/* Visual Workflow Showcase - THE STAR */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-44"
        >
          <WorkflowShowcase />
        </motion.div>

        {/* Explore - Tabbed Jobs/Resources/Servers */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-32"
        >
          <ExploreSection />
        </motion.div>

        {/* Dashboard Preview - Track Your Earnings */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mb-32"
        >
          <DashboardPreviewSection />
        </motion.div>

        {/* X402 Registry API */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={fadeInUp}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mb-32"
        >
          <DiscoverSection />
        </motion.div>

        {/* Footer CTA */}
      </main>

      {/* Create Job Modal (for blank jobs) */}
      <CreateJobModal
        isOpen={isCreateJobOpen}
        onClose={closeCreateJob}
        onCreate={handleCreateJob}
      />

      {/* Create Workflow Dialog (AI-powered) */}
      <CreateWorkflowDialog
        open={isWorkflowDialogOpen}
        onClose={handleCloseWorkflowDialog}
        initialPrompt={workflowDialogPrompt}
        initialNetwork={network}
      />
    </BaseLayout>
  );
}
