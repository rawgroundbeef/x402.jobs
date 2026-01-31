"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDraft, saveDraft, clearDraft, WizardDraft } from "@/lib/wizard-draft";
import { WizardShell } from "@/components/wizard/WizardShell";
import { Link2, Globe, Sparkles, Zap, LucideIcon } from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { formatDistanceToNow } from "date-fns";

type ResourceType = "link" | "proxy" | "claude" | "openrouter";

const TYPE_COLORS: Record<ResourceType, string> = {
  link: "#00d992",
  proxy: "#3b82f6",
  claude: "#f97316",
  openrouter: "#8b5cf6",
};

interface TypeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

function TypeCard({
  icon: Icon,
  title,
  description,
  color,
  onClick,
  variant = "secondary",
}: TypeCardProps) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        className="w-full flex flex-row items-center gap-4 text-left px-6 py-5 rounded-lg bg-card border border-border transition-all duration-150 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
        style={{
          borderLeftWidth: "3px",
          borderLeftColor: color,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.borderLeftColor = color;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "";
          e.currentTarget.style.borderLeftWidth = "3px";
          e.currentTarget.style.borderLeftColor = color;
        }}
      >
        <Icon className="w-8 h-8 shrink-0" style={{ color }} />
        <div>
          <h3 className="font-semibold text-card-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center text-center px-4 py-6 rounded-lg bg-card border border-border transition-all duration-150 hover:translate-y-[-2px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
      }}
    >
      <Icon className="w-7 h-7 mb-3" style={{ color }} />
      <h3 className="text-[15px] font-semibold text-card-foreground mb-1">{title}</h3>
      <p className="text-[13px] text-[#6b7684] leading-relaxed">{description}</p>
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
    router.push(`/dashboard/resources/new/${type}`);
  };

  const handleContinueEditing = () => {
    if (draft?.type) {
      router.push(`/dashboard/resources/new/${draft.type}`);
    }
  };

  const handleStartFresh = () => {
    clearDraft();
    setDraft(null);
  };

  if (!isLoaded) {
    return null;
  }

  const typeNames: Record<ResourceType, string> = {
    link: "Link Existing",
    proxy: "Proxy",
    claude: "Claude Prompt",
    openrouter: "OpenRouter",
  };

  return (
    <WizardShell
      step={1}
      totalSteps={3}
      title="Create Resource"
      description="Choose how you want to add your resource"
      showBack={false}
    >
      {/* Resume draft prompt */}
      {draft?.type && (
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <p className="text-card-foreground mb-1">
            You have an unfinished resource
          </p>
          <p className="text-card-foreground font-semibold mb-1">
            {draft.name ? `"${draft.name}" — ` : ""}{typeNames[draft.type]}
          </p>
          {draft.updatedAt && (
            <p className="text-sm text-[#5c6670] mb-5">
              Last edited {formatDistanceToNow(new Date(draft.updatedAt))} ago
            </p>
          )}
          <div className="flex gap-3">
            <Button variant="primary" onClick={handleContinueEditing}>
              Continue editing
            </Button>
            <Button variant="outline" onClick={handleStartFresh}>
              Start fresh
            </Button>
          </div>
        </div>
      )}

      {/* Type selection — always visible (below resume prompt if present) */}
      {!draft?.type && (
        <>
          {/* Link Existing — full width primary card */}
          <TypeCard
            icon={Link2}
            title="Link Existing"
            description="Connect your x402-enabled endpoint"
            color={TYPE_COLORS.link}
            onClick={() => handleSelectType("link")}
            variant="primary"
          />

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[13px] text-[#5c6670] whitespace-nowrap">or create something new</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Create cards — 3 in a row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TypeCard
              icon={Globe}
              title="Proxy"
              description="Wrap any URL with payments"
              color={TYPE_COLORS.proxy}
              onClick={() => handleSelectType("proxy")}
            />
            <TypeCard
              icon={Sparkles}
              title="Claude Prompt"
              description="Monetize a prompt"
              color={TYPE_COLORS.claude}
              onClick={() => handleSelectType("claude")}
            />
            <TypeCard
              icon={Zap}
              title="OpenRouter"
              description="Multi-model AI endpoint"
              color={TYPE_COLORS.openrouter}
              onClick={() => handleSelectType("openrouter")}
            />
          </div>
        </>
      )}
    </WizardShell>
  );
}
