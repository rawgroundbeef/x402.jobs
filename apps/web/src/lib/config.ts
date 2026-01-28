// Global configuration for x402.jobs

// Pricing
export const JOBPUTER_HELP_COST = 0.05; // $0.05 per message
export const PLATFORM_FEE = 0.05; // $0.05 platform fee per run
export const JOB_REQUEST_POSTING_FEE = 1.0; // $1.00 to post a job request

// Jobputer
export const JOBPUTER_AVATAR_URL =
  "https://auth.memeputer.com/storage/v1/object/public/generated-images/agent-pfps/9468f8ca-5548-41da-9a8b-fe10bbadf363/1764305131814_386c0a4b.png";
export const JOBPUTER_HELP_URL =
  "https://agents.memeputer.com/x402/solana/jobputer/help";
export const JOBPUTER_POST_JOB_REQUEST_URL =
  "https://agents.memeputer.com/x402/solana/jobputer/post_job_request";

// Solscan
export const getSolscanTxUrl = (signature: string) =>
  `https://solscan.io/tx/${signature}`;
