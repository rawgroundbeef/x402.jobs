"use client";

import { useState } from "react";
import { ChainIcon } from "@/components/icons/ChainIcons";
import {
  getResourceDisplayName,
  getSuccessRate,
  getSuccessRateColor,
} from "@/lib/format";
import { Copy, Check, ExternalLink, Calendar, Play } from "lucide-react";
import type { PublicJobData, WorkflowNode, TabType } from "../../types";

const PLATFORM_FEE = 0.05;

interface JobTabsProps {
  job: PublicJobData;
  isOwner: boolean;
  webhookUrl?: string;
  resourceNodes: WorkflowNode[];
  inputFields: Record<
    string,
    { type?: string; required?: boolean; description?: string }
  >;
  priceDisplay: string;
  creatorMarkup: number;
}

export default function JobTabs({
  job,
  isOwner,
  webhookUrl,
  resourceNodes,
  inputFields,
  priceDisplay,
  creatorMarkup,
}: JobTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-border pt-6">
      <div className="border-b border-border mb-6">
        <div className="flex gap-6">
          {(["overview", "api", "activity"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview"
                ? "Overview"
                : tab === "api"
                  ? "API Details"
                  : "Activity"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          job={job}
          isOwner={isOwner}
          webhookUrl={webhookUrl}
          resourceNodes={resourceNodes}
          priceDisplay={priceDisplay}
          creatorMarkup={creatorMarkup}
          copied={copied}
          onCopy={handleCopy}
        />
      )}

      {activeTab === "api" && (
        <ApiTab
          job={job}
          isOwner={isOwner}
          webhookUrl={webhookUrl}
          inputFields={inputFields}
          copied={copied}
          onCopy={handleCopy}
        />
      )}

      {activeTab === "activity" && <ActivityTab />}
    </div>
  );
}

interface OverviewTabProps {
  job: PublicJobData;
  isOwner: boolean;
  webhookUrl?: string;
  resourceNodes: WorkflowNode[];
  priceDisplay: string;
  creatorMarkup: number;
  copied: boolean;
  onCopy: (text: string) => void;
}

function OverviewTab({
  job,
  isOwner: _isOwner,
  webhookUrl,
  resourceNodes,
  priceDisplay,
  creatorMarkup,
  copied,
  onCopy,
}: OverviewTabProps) {
  return (
    <div className="space-y-3">
      {webhookUrl && (
        <div className="py-2 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">
              x402 Webhook URL
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onCopy(webhookUrl)}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <a
                href={webhookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </div>
          </div>
          <code className="text-sm font-mono text-foreground break-all">
            {webhookUrl}
          </code>
        </div>
      )}
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-sm text-muted-foreground">Network</span>
        <span className="text-sm font-medium flex items-center gap-1.5">
          <ChainIcon network={job.network} className="h-4 w-4" />
          {job.network === "base" ? "Base" : "Solana"}
        </span>
      </div>
      <div className="flex items-center justify-between py-2 border-b border-border">
        <span className="text-sm text-muted-foreground">Created</span>
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {new Date(job.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Cost Breakdown */}
      {resourceNodes.length > 0 && (
        <div className="py-2 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Cost</span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {priceDisplay}
            </span>
          </div>
          <div className="pl-4 space-y-1">
            {/* Public workflow: show individual resources */}
            {job.show_workflow ? (
              <>
                {resourceNodes.map((node, index) => {
                  const resource = node.data.resource!;
                  const resourcePrice =
                    typeof resource.price === "number"
                      ? resource.price
                      : parseFloat(
                          String(resource.price).replace(/[^0-9.]/g, ""),
                        ) || 0;

                  const serverSlug =
                    resource.serverSlug ||
                    resource.server?.slug ||
                    resource.server_slug ||
                    "";

                  const displayName = getResourceDisplayName({
                    ...resource,
                    serverSlug,
                  });

                  const isLast =
                    index === resourceNodes.length - 1 && creatorMarkup === 0;

                  // Calculate success rate if available
                  const successRate = getSuccessRate(
                    resource.success_count_30d,
                    resource.failure_count_30d,
                  );

                  return (
                    <div
                      key={node.id}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">
                          {isLast ? "└" : "├"}
                        </span>
                        {displayName}
                        {successRate !== null && (
                          <span
                            className={`ml-1 ${getSuccessRateColor(successRate)}`}
                          >
                            {successRate}%
                          </span>
                        )}
                      </span>
                      <span>${resourcePrice.toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground/50">
                      {creatorMarkup === 0 ? "└" : "├"}
                    </span>
                    Platform fee
                  </span>
                  <span>${PLATFORM_FEE.toFixed(2)}</span>
                </div>
              </>
            ) : (
              /* Hidden workflow: show aggregated resources */
              <>
                {(() => {
                  const totalResourceCost = resourceNodes.reduce(
                    (sum, node) => {
                      const resource = node.data.resource!;
                      const resourcePrice =
                        typeof resource.price === "number"
                          ? resource.price
                          : parseFloat(
                              String(resource.price).replace(/[^0-9.]/g, ""),
                            ) || 0;
                      return sum + resourcePrice;
                    },
                    0,
                  );

                  return (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="text-muted-foreground/50">├</span>
                        Resources ({resourceNodes.length})
                      </span>
                      <span>${totalResourceCost.toFixed(2)}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground/50">
                      {creatorMarkup === 0 ? "└" : "├"}
                    </span>
                    Platform fee
                  </span>
                  <span>${PLATFORM_FEE.toFixed(2)}</span>
                </div>
              </>
            )}
            {/* Creator markup - always show if > 0 */}
            {creatorMarkup > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground/50">└</span>
                  Creator payout
                </span>
                <span className="text-primary">
                  ${creatorMarkup.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ApiTabProps {
  job: PublicJobData;
  isOwner: boolean;
  webhookUrl?: string;
  inputFields: Record<
    string,
    { type?: string; required?: boolean; description?: string }
  >;
  copied: boolean;
  onCopy: (text: string) => void;
}

function ApiTab({
  job,
  isOwner,
  webhookUrl,
  inputFields,
  copied,
  onCopy,
}: ApiTabProps) {
  const workflowDef = job.workflow_definition;

  return (
    <div className="space-y-6">
      {webhookUrl && (
        <div>
          <h3 className="text-sm font-semibold mb-2">x402 Webhook URL</h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded break-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => onCopy(webhookUrl)}
              className="p-2 hover:bg-accent rounded transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <a
              href={webhookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-accent rounded transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </a>
          </div>
        </div>
      )}

      {Object.keys(inputFields).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Input Schema</h3>
          <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(inputFields, null, 2)}
          </pre>
        </div>
      )}

      {workflowDef && (isOwner || job.show_workflow) && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Workflow Definition</h3>
          <pre className="text-xs font-mono bg-muted p-4 rounded overflow-x-auto max-h-64 overflow-y-auto">
            {JSON.stringify(workflowDef, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  return (
    <div className="text-center py-12">
      <Play className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">Activity tracking coming soon</p>
      <p className="text-sm text-muted-foreground mt-1">
        Recent runs and usage statistics will appear here
      </p>
    </div>
  );
}
