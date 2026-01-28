"use client";

import { cn } from "@x402jobs/ui/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface PanelTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

/**
 * Tab bar for panel navigation (Railway-style).
 */
export function PanelTabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: PanelTabsProps) {
  return (
    <div className={cn("flex gap-1 border-b border-border px-4", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium transition-colors",
              "hover:text-foreground",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "min-w-[18px] h-[18px] px-1 rounded text-xs font-medium flex items-center justify-center",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {/* Active indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
