export interface PollStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

export interface PollProgress {
  completed: number;
  total: number;
}

export interface LROResult {
  response: string;
  fullData: unknown;
}

export interface LROPayment {
  amount: number;
  transaction: string;
}
