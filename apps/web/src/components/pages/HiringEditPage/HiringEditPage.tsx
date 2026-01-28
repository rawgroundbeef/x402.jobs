"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Button } from "@x402jobs/ui/button";
import { Card } from "@x402jobs/ui/card";
import { Input } from "@x402jobs/ui/input";
import { Select } from "@x402jobs/ui/select";
import { useToast } from "@x402jobs/ui/toast";
import { publicFetcher, authenticatedFetch } from "@/lib/api";
import {
  Briefcase,
  DollarSign,
  Plus,
  X,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Code,
} from "lucide-react";
import BaseLayout from "@/components/BaseLayout";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

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

interface HiringRequest {
  id: string;
  creator_user_id: string;
  title: string;
  description: string;
  requirements: string[];
  tags: string[];
  inputs: JobInput[];
  bounty_amount: number;
  escrow_status: "none" | "funded" | "released" | "refunded";
  status: "open" | "under_review" | "fulfilled" | "canceled" | "expired";
  expires_at?: string;
}

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

interface HiringEditPageProps {
  id: string;
}

export default function HiringEditPage({ id }: HiringEditPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data, isLoading, error } = useSWR<{ request: HiringRequest }>(
    `/bounties/requests/${id}`,
    publicFetcher,
  );

  const request = data?.request;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState<string[]>([""]);
  const [inputs, setInputs] = useState<JobInput[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [bountyAmount, setBountyAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (request && !initialized) {
      setTitle(request.title);
      setDescription(request.description);
      setRequirements(
        request.requirements.length > 0 ? request.requirements : [""],
      );
      setInputs(request.inputs || []);
      setTags(request.tags);
      setBountyAmount(request.bounty_amount.toString());
      if (request.expires_at) {
        const date = new Date(request.expires_at);
        setExpiresAt(date.toISOString().slice(0, 16));
      }
      setInitialized(true);
    }
  }, [request, initialized]);

  const isCreator = user?.id === request?.creator_user_id;
  const canEdit =
    request?.escrow_status === "none" && request?.status === "open";

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
        description: "Please sign in to edit this request",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your request",
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
      // Filter out empty inputs
      const filledInputs = inputs.filter((i) => i.name.trim());

      const response = await authenticatedFetch(`/bounties/requests/${id}`, {
        method: "PUT",
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

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update request");
      }

      toast({
        title: "Request updated!",
        description: "Your changes have been saved.",
        variant: "success",
      });

      router.push(`/bounties/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      </BaseLayout>
    );
  }

  if (error || !request) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium">Request not found</p>
          <Button as={Link} href="/bounties" variant="outline" className="mt-4">
            Back to Bounties
          </Button>
        </div>
      </BaseLayout>
    );
  }

  if (!user) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <PageHeader
          title="Edit Job Request"
          leftSlot={
            <Link
              href={`/bounties/${id}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          }
        />
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Sign in required</p>
          <p className="text-muted-foreground mb-4">
            You need to be signed in to edit this request
          </p>
          <Button as={Link} href="/login" variant="primary">
            Sign In
          </Button>
        </Card>
      </BaseLayout>
    );
  }

  if (!isCreator) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <PageHeader
          title="Edit Job Request"
          leftSlot={
            <Link
              href={`/bounties/${id}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          }
        />
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Not authorized</p>
          <p className="text-muted-foreground mb-4">
            You can only edit your own requests
          </p>
          <Button as={Link} href={`/bounties/${id}`} variant="outline">
            Back to Request
          </Button>
        </Card>
      </BaseLayout>
    );
  }

  if (!canEdit) {
    return (
      <BaseLayout maxWidth="max-w-6xl">
        <PageHeader
          title="Edit Job Request"
          leftSlot={
            <Link
              href={`/bounties/${id}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          }
        />
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">Cannot edit</p>
          <p className="text-muted-foreground mb-4">
            This request cannot be edited because it has been funded or is no
            longer open
          </p>
          <Button as={Link} href={`/bounties/${id}`} variant="outline">
            Back to Request
          </Button>
        </Card>
      </BaseLayout>
    );
  }

  return (
    <BaseLayout maxWidth="max-w-6xl">
      <PageHeader
        title="Edit Job Request"
        leftSlot={
          <Link
            href={`/bounties/${id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        }
      />

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
                Request will auto-expire if not fulfilled
              </p>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button as={Link} href={`/bounties/${id}`} variant="outline">
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </BaseLayout>
  );
}
