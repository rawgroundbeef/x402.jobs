export interface DashboardStats {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  callsThisWeek: number;
  callsLastWeek: number;
  trends: {
    earningsPercent: number;
    callsPercent: number;
  };
}

export interface EarningsDataPoint {
  date: string;
  earnings: number;
  runCount: number;
}

export interface EarningsResponse {
  data: EarningsDataPoint[];
  period: string;
  totalForPeriod: number;
}

export interface TopPerformer {
  type: "job" | "resource";
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  earnings: number;
  runCount: number;
  ownerUsername?: string;
  serverSlug?: string;
}

export interface TopPerformersResponse {
  items: TopPerformer[];
}

export interface ActivityEvent {
  id: string;
  type: "earning" | "call";
  timestamp: string;
  itemName: string;
  itemType: "job" | "resource";
  amount?: number;
  job?: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
  };
  resource?: {
    id: string;
    name: string;
    slug: string;
    serverSlug: string;
  };
}

export interface ActivityResponse {
  events: ActivityEvent[];
}

export interface ActionContext {
  jobCount: number;
  serverCount: number;
  resourceCount: number;
  hasBio: boolean;
  lastCreatedAt: string | null;
  serverWithFewResources: {
    id: string;
    name: string;
    resourceCount: number;
  } | null;
  topJobEarnings: number | null;
  walletBalance: number;
}
