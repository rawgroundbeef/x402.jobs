export const RESOURCE_CATEGORIES = [
  { value: "data", label: "Data" },
  { value: "ai", label: "AI" },
  { value: "developer", label: "Developer" },
  { value: "defi", label: "DeFi" },
  { value: "media", label: "Media" },
  { value: "identity", label: "Identity" },
  { value: "storage", label: "Storage" },
  { value: "social", label: "Social" },
  { value: "gaming", label: "Gaming" },
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]["value"];
