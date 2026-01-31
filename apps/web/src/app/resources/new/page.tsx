"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDraft, saveDraft, clearDraft, WizardDraft } from "@/lib/wizard-draft";
import { WizardShell } from "@/components/wizard/WizardShell";
import { Link2, Globe, Sparkles, Zap, LucideIcon } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { formatDistanceToNow } from "date-fns";

type ResourceType = "link" | "proxy" | "claude" | "openrouter";

interface TypeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  className?: string;
  variant?: "horizontal" | "vertical";
}

function TypeCard({
  icon: Icon,
  title,
  description,
  onClick,
  className = "",
  variant = "vertical"
}: TypeCardProps) {
  const baseClasses = "p-6 rounded-lg border border-[#252d3a] hover:border-[#00d992] hover:bg-[#00d992]/5 focus:outline-none focus:ring-2 focus:ring-[#00d992] focus:ring-offset-2 focus:ring-offset-[#111820] transition-colors duration-150";

  if (variant === "horizontal") {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} w-full flex flex-row items-center gap-4 text-left ${className}`}
      >
        <Icon className="w-6 h-6 text-[#00d992] shrink-0" />
        <div>
          <h3 className="font-semibold text-white mb-1">{title}</h3>
          <p className="text-sm text-[#5c6670]">{description}</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} flex flex-col items-center text-center ${className}`}
    >
      <Icon className="w-8 h-8 text-[#00d992] mb-3" />
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-[#5c6670]">{description}</p>
    </button>
  );
}

export default function NewResourcePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const existingDraft = getDraft();
    setDraft(existingDraft);
    setIsLoaded(true);
  }, []);

  const handleSelectType = (type: ResourceType) => {
    saveDraft({ type });
    router.push(`/resources/new/${type}`);
  };

  const handleContinueEditing = () => {
    if (draft?.type) {
      router.push(`/resources/new/${draft.type}`);
    }
  };

  const handleStartFresh = () => {
    clearDraft();
    setDraft(null);
  };

  // Loading state - prevent hydration mismatch
  if (!isLoaded) {
    return null;
  }

  // Resume prompt - if draft has type
  if (draft?.type) {
    const typeNames: Record<ResourceType, string> = {
      link: "Link Existing",
      proxy: "Proxy",
      claude: "Claude Prompt",
      openrouter: "OpenRouter",
    };

    const typeName = typeNames[draft.type];

    return (
      <WizardShell step={1} totalSteps={3} title="Resume Draft?">
        <div className="text-center py-8">
          <p className="text-white mb-2">
            You have an unfinished {typeName} resource
            {draft.name && (
              <span className="font-semibold">: &quot;{draft.name}&quot;</span>
            )}
          </p>
          {draft.updatedAt && (
            <p className="text-sm text-[#5c6670] mb-6">
              ({formatDistanceToNow(new Date(draft.updatedAt))} ago)
            </p>
          )}
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={handleStartFresh}>
              Start Fresh
            </Button>
            <Button variant="primary" onClick={handleContinueEditing}>
              Continue Editing
            </Button>
          </div>
        </div>
      </WizardShell>
    );
  }

  // Type selection - main view
  return (
    <WizardShell
      step={1}
      totalSteps={3}
      title="Choose Resource Type"
      showBack={false}
    >
      <div className="space-y-6">
        {/* Link Existing - full width primary card */}
        <TypeCard
          icon={Link2}
          title="Link Existing"
          description="Connect your x402-enabled endpoint"
          onClick={() => handleSelectType("link")}
          variant="horizontal"
        />

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-[#252d3a]" />
          <span className="text-sm text-[#5c6670]">or create something new</span>
          <div className="flex-1 h-px bg-[#252d3a]" />
        </div>

        {/* Create cards - 3 in a row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TypeCard
            icon={Globe}
            title="Proxy"
            description="Wrap any URL with payments"
            onClick={() => handleSelectType("proxy")}
            variant="vertical"
          />
          <TypeCard
            icon={Sparkles}
            title="Claude Prompt"
            description="Monetize a prompt"
            onClick={() => handleSelectType("claude")}
            variant="vertical"
          />
          <TypeCard
            icon={Zap}
            title="OpenRouter"
            description="Multi-model AI endpoint"
            onClick={() => handleSelectType("openrouter")}
            variant="vertical"
          />
        </div>
      </div>
    </WizardShell>
  );
}
