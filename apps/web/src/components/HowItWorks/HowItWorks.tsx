"use client";

import { Blocks, Tag, Coins } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Build",
    description: "Chain resources visually",
    icon: Blocks,
    color: "text-teal-500",
    bgColor: "bg-teal-50",
  },
  {
    number: "2",
    title: "Publish",
    description: "Set your price as x402 endpoint",
    icon: Tag,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
  },
  {
    number: "3",
    title: "Earn",
    description: "Get paid every run",
    icon: Coins,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50",
  },
];

export function HowItWorks() {
  return (
    <div className="py-8">
      <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-8">
        How It Works
      </h2>
      <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
        {steps.map((step) => (
          <div key={step.number} className="text-center">
            <div
              className={`w-14 h-14 rounded-2xl ${step.bgColor} flex items-center justify-center mx-auto mb-4`}
            >
              <step.icon className={`h-7 w-7 ${step.color}`} />
            </div>
            <div className="mb-2">
              <span
                className={`text-xs font-bold ${step.color} uppercase tracking-wider`}
              >
                Step {step.number}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {step.title}
            </h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
