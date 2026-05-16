import { randomUUID } from "crypto";

interface InstantJobResult {
  response: string;
  modality: string;
  artifactUrl?: string;
  imageDataUrl?: string;
  images?: string[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  receipt?: {
    transaction: string;
    paidUsdc: number;
  };
}

interface InstantJob {
  status: "processing" | "succeeded" | "failed";
  result?: InstantJobResult;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, InstantJob>();

const JOB_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Auto-cleanup expired jobs every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}, 60_000);

export function createJob(): string {
  const id = randomUUID();
  jobs.set(id, {
    status: "processing",
    createdAt: Date.now(),
  });
  return id;
}

export function completeJob(id: string, result: InstantJobResult): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "succeeded";
    job.result = result;
  }
}

export function failJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = "failed";
    job.error = error;
  }
}

export function getJob(id: string): InstantJob | null {
  return jobs.get(id) || null;
}
