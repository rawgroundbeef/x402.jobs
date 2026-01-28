"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { useToast } from "@x402jobs/ui/toast";
import { authenticatedFetch } from "@/lib/api";
import {
  Briefcase,
  DollarSign,
  Plus,
  X,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Info,
  Code,
} from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { JOB_REQUEST_POSTING_FEE } from "@/lib/config";

const SUGGESTED_TAGS = [
  "ai",
  "image-generation",
  "data-processing",
  "web3",
  "trading",
  "social",
  "automation",
  "analysis",
  "content",
  "api",
];

type JobInputType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "object";

interface JobInput {
  name: string;
  type: JobInputType;
  required: boolean;
  description: string;
}

const INPUT_TYPES: { value: JobInputType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Boolean" },
  { value: "string[]", label: "Text Array" },
  { value: "number[]", label: "Number Array" },
  { value: "object", label: "Object (JSON)" },
];

const EMPTY_INPUT: JobInput = {
  name: "",
  type: "string",
  required: true,
  description: "",
};

export default function HiringNewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [inputs, setInputs] = useState<JobInput[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addRequirement = () => {
    setRequirements([...requirements, ""]);
  };

  const updateRequirement = (index: number, value: string) => {
    const updated = [...requirements];
    updated[index] = value;
    setRequirements(updated);
  };

  const handleRequirementPaste = (index: number, e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text");
    const lines = pastedText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    if (lines.length > 1) {
      e.preventDefault();
      const before = requirements.slice(0, index);
      const after = requirements.slice(index + 1).filter((r) => r.trim());
      setRequirements([...before, ...lines, ...after]);
    }
  };

  const removeRequirement = (index: number) => {
    if (requirements.length > 1) {
      setRequirements(requirements.filter((_, i) => i !== index));
    }
  };

  const addInput = () => {
    setInputs([...inputs, { ...EMPTY_INPUT }]);
  };

  const updateInput = (
    index: number,
    field: keyof JobInput,
    value: unknown,
  ) => {
    const updated = [...inputs];
    updated[index] = { ...updated[index], [field]: value };
    setInputs(updated);
  };

  const removeInput = (index: number) => {
    setInputs(inputs.filter((_, i) => i !== index));
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !tags.includes(normalizedTag) && tags.length < 10) {
      setTags([...tags, normalizedTag]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to create a bounty",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your bounty",
        variant: "destructive",
      });
      return;
    }

    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe what you need built",
        variant: "destructive",
      });
      return;
    }

    const filledRequirements = requirements.filter((r) => r.trim());
    if (filledRequirements.length === 0) {
      toast({
        title: "Requirements required",
        description: "Please add at least one requirement",
        variant: "destructive",
      });
      return;
    }

    const bounty = parseFloat(bountyAmount);
    if (isNaN(bounty) || bounty <= 0) {
      toast({
        title: "Invalid bounty",
        description: "Please enter a valid bounty amount greater than $0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the bounty - backend handles the $1 posting fee payment
      console.log("📤 Creating bounty (backend will charge $1 posting fee)...");

      // Filter out empty inputs
      const filledInputs = inputs.filter((i) => i.name.trim());

      const response = await authenticatedFetch("/bounties/requests", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          requirements: filledRequirements,
          inputs: filledInputs,
          tags,
          bounty_amount: bounty,
          expires_at: expiresAt || undefined,
        }),
      });

      const data = await response.json();
      console.log("📥 Response:", data);

      if (!response.ok) {
        console.error("❌ Failed:", data);
        throw new Error(
          data.error || data.details || "Failed to create bounty",
        );
      }

      const { request, payment } = data;
      const txSignature = payment?.signature;

      // Show success with tx link in toast (no new tab)
      toast({
        title: "Bounty created!",
        description: txSignature
          ? `Posting fee paid ($${payment?.amount?.toFixed(2) || "1.00"}). Tx: ${txSignature.slice(0, 12)}...`
          : "Your bounty has been posted. Fund it to start receiving submissions.",
        variant: "success",
      });

      router.push(`/bounties/${request.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create bounty",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <PageHeader
          title="Create Bounty"
          leftSlot={
            <Link
              href="/bounties"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          }
        />
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Sign in to create a bounty</p>
          <p className="text-muted-foreground mb-4">
            You need to be signed in to create a bounty
          </p>
          <Button as={Link} href="/login" variant="primary">
            Sign In
          </Button>
        </Card>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title="Create Bounty"
        leftSlot={
          <Link
            href="/bounties"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        }
      />

      {/* How it works */}
      <Card className="p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20 mb-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-600 dark:text-blue-400">
              How it works
            </p>
            <ul className="text-sm text-muted-foreground mt-1 space-y-1">
              <li>
                1. Create your bounty for a{" "}
                <span className="font-medium text-foreground">
                  ${JOB_REQUEST_POSTING_FEE.toFixed(2)} posting fee
                </span>
              </li>
              <li>2. Fund the bounty to start receiving submissions</li>
              <li>3. Review submissions and approve the best one</li>
              <li>
                4. When quorum is reached (2/3 approvals), bounty is released
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6 pb-8">
        {/* Title */}
        <Card className="p-6">
          <label className="block mb-2 font-medium">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g., Build a Twitter sentiment analysis workflow"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <p className="text-sm text-muted-foreground mt-2">
            A clear, descriptive title for what you need built
          </p>
        </Card>

        {/* Description */}
        <Card className="p-6">
          <label className="block mb-2 font-medium">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full min-h-[150px] p-3 rounded-lg border border-border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Describe in detail what you need built. Include:
- What the workflow should do
- Expected inputs and outputs
- Any specific resources or APIs to use
- Performance requirements
- Example use cases"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Markdown supported. Be specific to get better submissions.
          </p>
        </Card>

        {/* Requirements */}
        <Card className="p-6">
          <label className="block mb-2 font-medium">
            Requirements <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {requirements.map((req, index) => (
              <div key={index} className="group flex items-center gap-2">
                <Input
                  placeholder={`Requirement ${index + 1}`}
                  value={req}
                  onChange={(e) => updateRequirement(index, e.target.value)}
                  onPaste={(e) => handleRequirementPaste(index, e)}
                />
                {requirements.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRequirement(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRequirement}
            className="mt-2"
          >
            <Plus className="w-4 h-4" />
            Add Requirement
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            List specific requirements that submissions must meet
          </p>
        </Card>

        {/* Inputs / Parameters */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Code className="w-4 h-4 text-muted-foreground" />
            <label className="font-medium">
              Input Parameters{" "}
              <span className="text-muted-foreground text-sm">(optional)</span>
            </label>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Define the inputs/parameters the job should accept.
          </p>

          {inputs.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {inputs.map((input, index) => (
                <div
                  key={index}
                  className="group relative flex items-center gap-2 py-1.5 px-2 border border-border rounded-md bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  {/* Required indicator */}
                  <button
                    type="button"
                    onClick={() =>
                      updateInput(index, "required", !input.required)
                    }
                    className={`w-1.5 h-6 rounded-full transition-colors flex-shrink-0 ${
                      input.required
                        ? "bg-red-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    title={
                      input.required
                        ? "Required (click to make optional)"
                        : "Optional (click to make required)"
                    }
                  />

                  {/* Name */}
                  <Input
                    placeholder="param_name"
                    value={input.name}
                    onChange={(e) => updateInput(index, "name", e.target.value)}
                    className="font-mono text-sm w-40 flex-shrink-0"
                  />

                  {/* Type */}
                  <Select
                    value={input.type}
                    onChange={(value) =>
                      updateInput(index, "type", value as JobInputType)
                    }
                    options={INPUT_TYPES.map((t) => ({
                      value: t.value,
                      label: t.label,
                    }))}
                    className="w-32 flex-shrink-0"
                  />

                  {/* Description */}
                  <Input
                    placeholder="Description..."
                    value={input.description}
                    onChange={(e) =>
                      updateInput(index, "description", e.target.value)
                    }
                    className="flex-1 text-sm"
                  />

                  {/* Delete */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeInput(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={addInput}>
            <Plus className="w-4 h-4" />
            Add Parameter
          </Button>

          {inputs.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />{" "}
              = required
            </p>
          )}
        </Card>

        {/* Tags */}
        <Card className="p-6">
          <label className="block mb-2 font-medium">Tags</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addTag(tagInput)}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-sm text-muted-foreground">Suggested:</span>
            {SUGGESTED_TAGS.filter((t) => !tags.includes(t))
              .slice(0, 6)
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => addTag(tag)}
                  className="px-2 py-0.5 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors"
                >
                  {tag}
                </button>
              ))}
          </div>
        </Card>

        {/* Bounty & Expiration */}
        <Card className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-medium">
                Bounty Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="100.00"
                  value={bountyAmount}
                  onChange={(e) => setBountyAmount(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Amount paid to the winning submission (USD)
              </p>
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Expiration Date{" "}
                <span className="text-muted-foreground text-sm">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="pl-10"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Bounty will auto-expire if not fulfilled
              </p>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            💰 Posting fee:{" "}
            <span className="font-medium text-foreground">
              ${JOB_REQUEST_POSTING_FEE.toFixed(2)}
            </span>
          </p>
          <div className="flex gap-3">
            <Button as={Link} href="/bounties" variant="outline">
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing payment...
                </>
              ) : (
                <>
                  <Briefcase className="w-4 h-4" />
                  Create Bounty · ${JOB_REQUEST_POSTING_FEE.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </BaseLayout>
  );
}
