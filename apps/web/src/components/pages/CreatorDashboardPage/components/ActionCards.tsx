"use client";

import Link from "next/link";
import { Card } from "@x402jobs/ui/card";
import { Button } from "@x402jobs/ui/button";
import {
  Briefcase,
  Server,
  Box,
  DollarSign,
  User,
  Sparkles,
  Compass,
  ChevronRight,
} from "lucide-react";
import type { ActionContext } from "@/types/dashboard";

interface Props {
  context: ActionContext | undefined;
}

interface ActionCard {
  id: string;
  title: string;
  description: string;
  icon: typeof Briefcase;
  href: string;
  ctaLabel: string;
  priority: number;
}

export function ActionCards({ context }: Props) {
  if (!context) {
    return null;
  }

  // Build action cards based on user state
  const cards: ActionCard[] = [];

  // Priority 1: No jobs
  if (context.jobCount === 0) {
    cards.push({
      id: "create-job",
      title: "Create Your First Job",
      description:
        "Jobs let you chain resources into workflows. Creators with jobs earn 3x more.",
      icon: Briefcase,
      href: "/jobs/new",
      ctaLabel: "Create Job",
      priority: 1,
    });
  }

  // Priority 2: No servers
  if (context.serverCount === 0) {
    cards.push({
      id: "register-server",
      title: "Register a Server",
      description:
        "Servers let you publish multiple resources under one namespace.",
      icon: Server,
      href: "/servers/new",
      ctaLabel: "Add Server",
      priority: 2,
    });
  }

  // Priority 3: Server with few resources
  if (context.serverWithFewResources) {
    cards.push({
      id: "add-resources",
      title: "Add More Resources",
      description: `Your server "${context.serverWithFewResources.name}" only has ${context.serverWithFewResources.resourceCount} resources. More resources = more discovery.`,
      icon: Box,
      href: `/servers/${context.serverWithFewResources.id}/resources/new`,
      ctaLabel: "Add Resource",
      priority: 3,
    });
  }

  // Priority 4: Low pricing (has earnings but they're low)
  if (
    context.topJobEarnings !== null &&
    context.topJobEarnings < 1 &&
    context.jobCount > 0
  ) {
    cards.push({
      id: "raise-prices",
      title: "Consider Raising Prices",
      description:
        "Your most popular job is earning less than $1. You might be undercharging.",
      icon: DollarSign,
      href: "/dashboard/jobs",
      ctaLabel: "Edit Pricing",
      priority: 4,
    });
  }

  // Priority 5: Empty bio
  if (!context.hasBio) {
    cards.push({
      id: "complete-profile",
      title: "Complete Your Profile",
      description: "Profiles with bios get 2x more clicks.",
      icon: User,
      href: "/dashboard/account",
      ctaLabel: "Edit Profile",
      priority: 5,
    });
  }

  // Priority 6: Inactive (no creation in 30 days)
  if (context.lastCreatedAt) {
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(context.lastCreatedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceCreation > 30) {
      cards.push({
        id: "stay-active",
        title: "Stay Active",
        description: `Your last resource was added ${daysSinceCreation} days ago. Keep the momentum going.`,
        icon: Sparkles,
        href: "/create",
        ctaLabel: "Create Something",
        priority: 6,
      });
    }
  }

  // Priority 7: Default fallback
  if (cards.length === 0) {
    cards.push({
      id: "explore",
      title: "Explore Trending",
      description: "See what other creators are building.",
      icon: Compass,
      href: "/developers",
      ctaLabel: "Explore",
      priority: 7,
    });
  }

  // Sort by priority and take top 3
  const displayCards = cards
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Suggested Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayCards.map((card) => (
          <Card
            key={card.id}
            className="p-5 transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {card.description}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link href={card.href} className="flex items-center gap-1">
                    {card.ctaLabel}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
