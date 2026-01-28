"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import BaseLayout from "@/components/BaseLayout";
import { JobEditModal } from "@/components/modals/JobEditModal";
import { formatPrice, getSuccessRate } from "@/lib/format";
import { AlertCircle } from "lucide-react";

import JobHeader from "./components/JobHeader";
import WorkflowVisualization from "./components/WorkflowVisualization";
import RunJobForm from "./components/RunJobForm";
import JobTabs from "./components/JobTabs";
import { useJobExecution } from "./lib/useJobExecution";
import type { PublicJobData } from "./types";

interface PublicJobViewProps {
  job: PublicJobData;
  isOwner?: boolean;
}

export function PublicJobView({ job, isOwner = false }: PublicJobViewProps) {
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);

  const hasWebhook =
    job.trigger_methods?.webhook || job.trigger_type === "webhook";
  const webhookUrl = job.webhook_url;
  const workflowDef = job.workflow_definition;

  // Get resource nodes (exclude start/end nodes)
  const resourceNodes = useMemo(
    () =>
      (workflowDef?.nodes || []).filter(
        (node) => node.type === "resource" && node.data?.resource,
      ),
    [workflowDef],
  );

  // Calculate total price
  const resourcesPrice = useMemo(
    () =>
      resourceNodes.reduce((sum, node) => {
        const priceVal = node.data.resource?.price;
        if (typeof priceVal === "number") return sum + priceVal;
        if (typeof priceVal === "string") {
          return sum + (parseFloat(priceVal.replace(/[^0-9.]/g, "")) || 0);
        }
        return sum;
      }, 0),
    [resourceNodes],
  );

  const PLATFORM_FEE = 0.05;
  const baseCost = resourcesPrice + PLATFORM_FEE;
  const creatorMarkup = parseFloat(String(job.creator_markup)) || 0;
  const finalPrice = baseCost + creatorMarkup;

  // Stats
  const runCount = job.run_count || 0;
  const totalEarned = job.total_earnings_usdc
    ? parseFloat(job.total_earnings_usdc)
    : 0;

  // Input fields
  const inputFields = useMemo(
    () => job.webhook_input_schema || {},
    [job.webhook_input_schema],
  );

  // Job execution hook
  const execution = useJobExecution({
    jobId: job.id,
    webhookUrl,
    inputFields,
  });

  // Build display path
  const jobPath = useMemo(() => {
    const slug = job.slug || job.name.toLowerCase().replace(/\s+/g, "-");
    return job.owner_username ? `@${job.owner_username}/${slug}` : slug;
  }, [job.slug, job.name, job.owner_username]);

  const priceDisplay = formatPrice(String(finalPrice * 1_000_000));

  // Determine trigger type label
  const triggerLabel = job.trigger_type === "schedule" ? "Schedule" : "Webhook";

  // Calculate success rate for warnings
  const successRate = getSuccessRate(
    job.success_count_30d || 0,
    job.failure_count_30d || 0,
  );

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <main className="w-full pb-12">
        {/* Header Section */}
        <JobHeader
          job={job}
          isOwner={isOwner}
          jobPath={jobPath}
          totalEarned={totalEarned}
          runCount={runCount}
          resourceNodes={resourceNodes}
          onEditClick={() => setShowEditModal(true)}
        />

        {/* Workflow Visualization */}
        <WorkflowVisualization
          job={job}
          isOwner={isOwner}
          resourceNodes={resourceNodes}
          triggerLabel={triggerLabel}
        />

        {/* Run Section */}
        {hasWebhook && webhookUrl && (
          <RunJobForm
            webhookUrl={webhookUrl}
            priceDisplay={priceDisplay}
            finalPrice={finalPrice}
            successRate={successRate}
            jobName={jobPath}
            formData={execution.formData}
            fieldErrors={execution.fieldErrors}
            fieldEntries={execution.fieldEntries}
            hasInputs={execution.hasInputs}
            onFieldChange={execution.handleFieldChange}
            isLoading={execution.isLoading}
            onSubmit={execution.handleSubmit}
            onValidate={execution.validateForm}
            isPolling={execution.isPolling}
            pollStatus={execution.pollStatus}
            pollProgress={execution.pollProgress}
            pollRawData={execution.pollRawData}
            pollSteps={execution.pollSteps}
            showAdvancedLogs={execution.showAdvancedLogs}
            onAdvancedLogsToggle={execution.setShowAdvancedLogs}
            result={execution.result}
            error={execution.error}
            payment={execution.payment}
            showFullResult={execution.showFullResult}
            onShowFullResultToggle={() =>
              execution.setShowFullResult(!execution.showFullResult)
            }
            outputCopied={execution.outputCopied}
            onCopyOutput={execution.handleCopyOutput}
          />
        )}

        {/* Tabs Section */}
        <JobTabs
          job={job}
          isOwner={isOwner}
          webhookUrl={webhookUrl}
          resourceNodes={resourceNodes}
          inputFields={inputFields}
          priceDisplay={priceDisplay}
          creatorMarkup={creatorMarkup}
        />

        {/* No webhook configured */}
        {!hasWebhook && (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              This job is not configured for webhook triggers.
            </p>
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {isOwner && (
        <JobEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          job={{
            id: job.id,
            name: job.name,
            slug: job.slug,
            description: job.description,
            avatar_url: job.avatar_url,
            owner_username: job.owner_username,
            show_workflow: job.show_workflow,
          }}
          onSaved={(newSlug) => {
            if (newSlug && job.owner_username) {
              router.push(`/@${job.owner_username}/${newSlug}`);
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </BaseLayout>
  );
}
