"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import useSWR from "swr";
import { Input } from "@x402jobs/ui/input";
import { Textarea } from "@x402jobs/ui/textarea";
import { Select } from "@x402jobs/ui/select";
import { Button } from "@x402jobs/ui/button";
import { WizardShell } from "@/components/wizard/WizardShell";
import { getDraft, saveDraft, WizardDraft } from "@/lib/wizard-draft";
import { RESOURCE_CATEGORIES } from "@/constants/categories";
import { getAllNetworks } from "@/lib/networks";
import { authenticatedFetch, authenticatedFetcher } from "@/lib/api";
import { ImageDropZone } from "@/components/inputs/ImageDropZone";

// Generate URL-safe slug from text
function generateSlug(text: string): string {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length > 60) {
    slug = slug.substring(0, 60).replace(/-$/, "");
  }
  return slug;
}

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const detailsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(slugRegex, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  price: z
    .string()
    .min(1, "Price is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0.01;
      },
      "Minimum price is $0.01"
    ),
  network: z.enum(["base", "solana"]),
});

type DetailsFormData = z.infer<typeof detailsSchema>;

export default function DetailsPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const slugManuallyEdited = useRef(false);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; reason?: string } | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // Load user profile for username display
  const { data: profileData } = useSWR<{ profile: { username: string } | null }>(
    "/user/profile",
    authenticatedFetcher
  );
  const username = profileData?.profile?.username || "username";

  useEffect(() => {
    const d = getDraft();
    if (!d?.type) {
      router.replace("/dashboard/resources/new");
      return;
    }
    setDraft(d);
    setIsLoaded(true);
  }, [router]);

  const isPreFilled = draft?.preFilled || {};
  const isLinkType = draft?.type === "link";

  // Slug prefix: server slug for link type, @username for instant types
  const slugPrefix = isLinkType && draft?.serverSlug
    ? `/${draft.serverSlug}/`
    : `/@${username}/`;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      imageUrl: "",
      category: "",
      price: "",
      network: "base",
    },
  });

  // Reset form values once draft loads (useForm captures defaults on first render when draft is null)
  useEffect(() => {
    if (draft) {
      reset({
        name: draft.name || "",
        slug: draft.slug || "",
        description: draft.description || "",
        imageUrl: draft.imageUrl || "",
        category: draft.category || "",
        price: draft.price || "",
        network: (draft.network as "base" | "solana") || "base",
      });
    }
  }, [draft, reset]);

  const slug = watch("slug");
  const network = watch("network");

  // Slug auto-generation from name
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      if (!slugManuallyEdited.current) {
        const newSlug = generateSlug(newName);
        setValue("slug", newSlug, { shouldValidate: true });
      }
    },
    [setValue]
  );

  // Mark slug as manually edited
  const handleSlugChange = useCallback(() => {
    slugManuallyEdited.current = true;
  }, []);

  // Debounced slug uniqueness check
  useEffect(() => {
    // Reset status if slug is empty or invalid
    if (!slug || !slugRegex.test(slug)) {
      setSlugStatus(null);
      setIsCheckingSlug(false);
      return;
    }

    if (!network) {
      setSlugStatus(null);
      setIsCheckingSlug(false);
      return;
    }

    // Debounce API call
    setIsCheckingSlug(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await authenticatedFetch(
          `/resources/check-slug?slug=${encodeURIComponent(slug)}&network=${network}`
        );
        const data = await response.json();
        setSlugStatus(data);
      } catch (error) {
        console.error("Failed to check slug availability:", error);
        setSlugStatus(null);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      setIsCheckingSlug(false);
    };
  }, [slug, network]);

  // Form submit handler
  const onSubmit = (data: DetailsFormData) => {
    if (slugStatus && !slugStatus.available) return;
    saveDraft({
      name: data.name.trim(),
      slug: data.slug.trim(),
      description: data.description?.trim() || undefined,
      imageUrl: data.imageUrl || undefined,
      category: data.category,
      price: data.price,
      network: data.network,
      // Preserve type-specific fields from config step
      ...(draft?.resourceUrl && { resourceUrl: draft.resourceUrl }),
      ...(draft?.preFilled && { preFilled: draft.preFilled }),
      ...(draft?.linkConfig && { linkConfig: draft.linkConfig }),
      ...(draft?.proxyConfig && { proxyConfig: draft.proxyConfig }),
      ...(draft?.claudeConfig && { claudeConfig: draft.claudeConfig }),
      ...(draft?.openrouterConfig && { openrouterConfig: draft.openrouterConfig }),
    });
    router.push("/dashboard/resources/new/review");
  };

  if (!isLoaded || !draft) return null;

  return (
    <WizardShell
      step={3}
      totalSteps={4}
      title="Resource Details"
      backHref={`/dashboard/resources/new/${draft.type}`}
      footer={
        <Button
          type="submit"
          form="details-form"
          disabled={!isValid || (slugStatus !== null && !slugStatus.available)}
        >
          Continue
        </Button>
      }
    >
      <form id="details-form" onSubmit={handleSubmit(onSubmit)}>
        {/* Endpoint context for link and proxy types */}
        {draft.type === "link" && draft.resourceUrl && (
          <div className="px-3 py-2 mb-6 bg-muted/30 border border-border/50 rounded-md text-xs text-muted-foreground font-mono truncate">
            {draft.resourceUrl}
          </div>
        )}
        {draft.type === "proxy" && draft.proxyConfig && (
          <div className="px-3 py-2 mb-6 bg-muted/30 border border-border/50 rounded-md text-xs text-muted-foreground font-mono truncate">
            {(draft.proxyConfig as { originUrl?: string }).originUrl}
          </div>
        )}

        {/* Identity block: image + name + slug */}
        <div className="flex gap-6 items-start pb-8 mb-8 border-b border-border sm:flex-row flex-col items-center sm:items-start">
          <div className="flex-shrink-0">
            <ImageDropZone
              value={watch("imageUrl") || ""}
              onChange={(url) => setValue("imageUrl", url)}
            />
          </div>
          <div className="flex-1 flex flex-col gap-4 w-full">
            {/* Name field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                {...register("name")}
                onChange={(e) => {
                  register("name").onChange(e);
                  handleNameChange(e);
                }}
                placeholder="My API Resource"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* URL Slug field */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                URL Slug <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center flex-1 min-w-0">
                  <span
                    className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded-l-md border border-r-0 border-input flex items-center h-9 whitespace-nowrap max-w-[200px] truncate flex-shrink-0"
                    title={slugPrefix}
                  >
                    {slugPrefix}
                  </span>
                  <Input
                    {...register("slug")}
                    onChange={(e) => {
                      register("slug").onChange(e);
                      handleSlugChange();
                    }}
                    className="rounded-l-none"
                    placeholder="my-api-resource"
                  />
                </div>
                {/* Slug status indicators — inline */}
                {isCheckingSlug && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">Checking...</span>
                )}
                {!isCheckingSlug && slugStatus?.available && (
                  <span className="text-xs text-green-500 whitespace-nowrap flex-shrink-0">Available</span>
                )}
                {!isCheckingSlug && slugStatus && !slugStatus.available && (
                  <span className="text-xs text-destructive whitespace-nowrap flex-shrink-0">
                    {slugStatus.reason || "Taken"}
                  </span>
                )}
              </div>
              {errors.slug && (
                <p className="text-sm text-destructive mt-1">{errors.slug.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Rest of form */}
        <div className="space-y-6">
          {/* Description textarea */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Description
            </label>
            <Textarea
              {...register("description")}
              placeholder="Describe what your resource does..."
              rows={3}
            />
          </div>

          {/* Category + Price side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Category <span className="text-destructive">*</span>
              </label>
              <Select
                value={watch("category")}
                onChange={(val) => setValue("category", val, { shouldValidate: true })}
                options={RESOURCE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                placeholder="Select a category"
              />
              {errors.category && (
                <p className="text-sm text-destructive mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Price (USDC) <span className="text-destructive">*</span>
                {isPreFilled.price && (
                  <span className="text-xs text-muted-foreground ml-2">(Detected)</span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  {...register("price")}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.01"
                  className="pl-7"
                  disabled={!!isPreFilled.price}
                  readOnly={!!isPreFilled.price}
                />
              </div>
              {errors.price && (
                <p className="text-sm text-destructive mt-1">{errors.price.message}</p>
              )}
            </div>
          </div>

          {/* Network selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Network <span className="text-destructive">*</span>
              {isPreFilled.network && (
                <span className="text-xs text-muted-foreground ml-2">(Detected from endpoint)</span>
              )}
            </label>
            <Select
              value={watch("network")}
              onChange={(val) => {
                if (isPreFilled.network) return;
                setValue("network", val as "base" | "solana", { shouldValidate: true });
              }}
              options={getAllNetworks().map((n) => ({ value: n.id, label: n.name }))}
              disabled={!!isPreFilled.network}
            />
            {errors.network && (
              <p className="text-sm text-destructive mt-1">{errors.network.message}</p>
            )}
          </div>
        </div>
      </form>
    </WizardShell>
  );
}
