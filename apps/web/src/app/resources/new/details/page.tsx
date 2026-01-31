"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDraft, WizardDraft } from "@/lib/wizard-draft";
import { WizardShell } from "@/components/wizard/WizardShell";

export default function DetailsPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<WizardDraft | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const existingDraft = getDraft();
    if (!existingDraft?.type) {
      router.replace("/resources/new");
      return;
    }
    setDraft(existingDraft);
    setIsLoaded(true);
  }, [router]);

  if (!isLoaded || !draft) return null;

  // Dynamic back href based on draft type
  const backHref = `/resources/new/${draft.type}`;

  return (
    <WizardShell
      step={3}
      totalSteps={3}
      title="Resource Details"
      backHref={backHref}
    >
      <div className="text-center py-12 text-[#5c6670]">
        <p className="text-lg mb-2">Coming in Phase 24</p>
        <p className="text-sm">This step will be implemented in a future phase.</p>
      </div>
    </WizardShell>
  );
}
