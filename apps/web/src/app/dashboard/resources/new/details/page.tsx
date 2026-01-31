"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDraft, WizardDraft } from "@/lib/wizard-draft";
import { WizardShell } from "@/components/wizard/WizardShell";

export default function DetailsPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [draft, setDraft] = useState<WizardDraft | null>(null);

  useEffect(() => {
    const d = getDraft();
    if (!d?.type) {
      router.replace("/dashboard/resources/new");
      return;
    }
    setDraft(d);
    setIsLoaded(true);
  }, [router]);

  if (!isLoaded || !draft) return null;

  return (
    <WizardShell
      step={3}
      totalSteps={3}
      title="Resource Details"
      backHref={`/dashboard/resources/new/${draft.type}`}
    >
      <div className="text-center py-12 text-[#5c6670]">
        <p className="text-lg mb-2">Coming in Phase 20</p>
        <p className="text-sm">This step will be implemented in a future phase.</p>
      </div>
    </WizardShell>
  );
}
