"use client";

import {
  X,
  Zap,
  Box,
  Shuffle,
  Monitor,
  ExternalLink,
  Download,
  Upload,
} from "lucide-react";
import { Button } from "@x402jobs/ui/button";
import { AddResourceModalButton } from "@/components/AddResourceModalButton";

const DOCS_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3008"
    : "https://docs.memeputer.com";

interface DocsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocsPanel({ isOpen, onClose }: DocsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-card border-l border-border z-50 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header - matches main app header height */}
        <div className="h-[53px] flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-foreground">Documentation</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Quick Start */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Quick Start
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Build workflows by connecting nodes together. Each workflow starts
              with a <strong>Trigger</strong>, processes through{" "}
              <strong>Resources</strong> and <strong>Transforms</strong>, and
              ends with an <strong>Output</strong>.
            </p>
          </section>

          {/* Node Types */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Node Types
            </h3>
            <div className="space-y-4">
              {/* Trigger */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-trigger/20 flex items-center justify-center flex-shrink-0">
                  <Zap className="h-4 w-4 text-trigger" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Trigger
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Starts your workflow. Click the &quot;Go&quot; button to run
                    the workflow manually.
                  </p>
                </div>
              </div>

              {/* Resource */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-resource/20 flex items-center justify-center flex-shrink-0">
                  <Box className="h-4 w-4 text-resource" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Resource
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    x402 endpoints you pay to use. Each resource has a price in
                    USDC. Configure inputs by double-clicking the node.
                  </p>
                </div>
              </div>

              {/* Transform */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-transform/20 flex items-center justify-center flex-shrink-0">
                  <Shuffle className="h-4 w-4 text-transform" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Transform
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Process data between resources. Extract fields, apply
                    templates, or run custom JavaScript code.
                  </p>
                </div>
              </div>

              {/* Output */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-output/20 flex items-center justify-center flex-shrink-0">
                  <Monitor className="h-4 w-4 text-output" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Output
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Displays the final result of your workflow. Click to expand
                    and view the full output.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Connecting Nodes */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Connecting Nodes
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Drag from a node&apos;s output handle to another node&apos;s
                input handle
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Connected outputs become available as &quot;Linked Inputs&quot;
                in downstream nodes
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Select a line and press Delete to remove it
              </li>
            </ul>
          </section>

          {/* Configuring Resources */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Configuring Resources
            </h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Double-click a resource node to configure its inputs
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Choose between static values or linked inputs from upstream
                nodes
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Use &quot;Try It&quot; to test a resource before running the
                full workflow
              </li>
            </ul>
          </section>

          {/* Adding Your Own Resources */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Adding Resources
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Any x402-compatible API can be added as a resource. Enter the
              endpoint URL and we&apos;ll fetch its metadata, pricing, and input
              schema automatically.
            </p>
            <AddResourceModalButton
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={onClose}
            />
          </section>

          {/* Pricing */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Pricing
            </h3>
            <div className="text-sm text-muted-foreground space-y-3">
              <p className="leading-relaxed">
                <strong className="text-foreground">Pay-per-use:</strong> Each
                resource displays its price in USDC. You only pay for resources
                that execute.
              </p>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-xs">
                  <span className="text-foreground font-medium">
                    Platform fee:
                  </span>{" "}
                  $0.05 per job run
                </p>
                <p className="text-xs">
                  <span className="text-foreground font-medium">
                    Resource costs:
                  </span>{" "}
                  Paid directly to resource providers
                </p>
                <p className="text-xs">
                  <span className="text-foreground font-medium">Gas fees:</span>{" "}
                  Covered by the network (gas-free!)
                </p>
              </div>
              <p className="text-xs italic">
                Total cost is shown before running. Fund your wallet with USDC
                on Solana.
              </p>
            </div>
          </section>

          {/* Export & Import */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Export & Import
            </h3>
            <div className="space-y-4">
              {/* Export */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Download className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Export Job
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click Save dropdown → Export JSON to download your workflow
                    as a shareable file.
                  </p>
                </div>
              </div>

              {/* Import */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Upload className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    Import Job
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create Job → Import JSON tab. Paste or drop a JSON file to
                    create from a template.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Tips</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Click Save to persist your workflow. You&apos;ll be warned if
                you try to leave with unsaved changes.
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Use Transform nodes to shape data between resources
              </li>
              <li className="flex gap-2">
                <span className="text-foreground">•</span>
                Async resources (like image generation) are polled automatically
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <a
            href={`${DOCS_BASE_URL}/jobs/getting-started/introduction`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button variant="outline" className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              Full Documentation
            </Button>
          </a>
        </div>
      </div>
    </>
  );
}
