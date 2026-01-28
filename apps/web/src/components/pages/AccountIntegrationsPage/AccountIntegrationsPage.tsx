"use client";

import ClaudeCard from "./components/ClaudeCard";
import OpenRouterCard from "./components/OpenRouterCard";
import TelegramCard from "./components/TelegramCard";
import XCard from "./components/XCard";

export default function AccountIntegrationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external services and AI providers.
        </p>
      </header>

      <ClaudeCard />
      <OpenRouterCard />
      <TelegramCard />
      <XCard />
    </div>
  );
}
