"use client";

import {
  Database,
  Globe,
  Clock,
  Hash,
  Webhook,
  BarChart2,
  Lock,
} from "lucide-react";
import { SlidePanel } from "./SlidePanel";
import type { SourceType } from "@/components/workflow/nodes/SourceNode";

interface SourceOption {
  type: SourceType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  available: boolean;
}

const SOURCE_OPTIONS: SourceOption[] = [
  {
    type: "job_history",
    name: "Job History",
    description: "Access outputs from previous job runs",
    icon: Database,
    available: true,
  },
  {
    type: "url_fetch",
    name: "URL Fetch",
    description: "GET any public URL",
    icon: Globe,
    available: true,
  },
];

// Future sources (shown as coming soon)
const COMING_SOON_SOURCES = [
  {
    name: "Static JSON",
    description: "Hardcoded JSON data",
    icon: Hash,
  },
  {
    name: "Current Time",
    description: "Current timestamp in various formats",
    icon: Clock,
  },
  {
    name: "Webhook Payload",
    description: "Data from the triggering webhook",
    icon: Webhook,
  },
  {
    name: "Platform Stats",
    description: "Job and resource usage statistics",
    icon: BarChart2,
  },
  {
    name: "User Secrets",
    description: "Securely stored API keys and tokens",
    icon: Lock,
  },
];

interface SourcesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (sourceType: SourceType) => void;
}

export function SourcesPanel({
  isOpen,
  onClose,
  onSelectSource,
}: SourcesPanelProps) {
  const handleSelectSource = (source: SourceOption) => {
    if (source.available) {
      onSelectSource(source.type);
      onClose();
    }
  };

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title="Add Source" fullBleed>
      <div className="flex-1 overflow-y-auto">
        {/* Available sources */}
        <div className="p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Available
          </p>
          <div className="space-y-1">
            {SOURCE_OPTIONS.map((source) => {
              const Icon = source.icon;
              return (
                <button
                  key={source.type}
                  onClick={() => handleSelectSource(source)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-source/20 text-source flex items-center justify-center flex-shrink-0 group-hover:bg-source/30 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{source.name}</p>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/20 text-emerald-500">
                        FREE
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {source.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming soon sources */}
        <div className="p-3 pt-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-2">
            Coming Soon
          </p>
          <div className="space-y-1">
            {COMING_SOON_SOURCES.map((source) => {
              const Icon = source.icon;
              return (
                <div
                  key={source.name}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg opacity-50 cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">
                      {source.name}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {source.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Sources are free platform-native data inputs
        </p>
      </div>
    </SlidePanel>
  );
}
