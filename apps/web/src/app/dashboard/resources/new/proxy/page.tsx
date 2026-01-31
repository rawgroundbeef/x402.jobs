"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDraft } from "@/lib/wizard-draft";
import { WizardShell } from "@/components/wizard/WizardShell";

export default function ProxyConfigPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const draft = getDraft();
    if (!draft?.type) {
      router.replace("/dashboard/resources/new");
      return;
    }
    setIsLoaded(true);
  }, [router]);

  if (!isLoaded) return null;

  return (
    <WizardShell
      step={2}
      totalSteps={3}
      title="Configure Proxy"
      backHref="/dashboard/resources/new"
    >
      <div className="text-center py-12 text-[#5c6670]">
        <p className="text-lg mb-2">Coming in Phase 22</p>
        <p className="text-sm">This step will be implemented in a future phase.</p>
      </div>
    </WizardShell>
  );
}
