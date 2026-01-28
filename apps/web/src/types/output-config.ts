/**
 * Output configuration types for workflow output nodes
 */

export interface OutputDestination {
  type: "app" | "telegram" | "x" | "x402storage";
  enabled: boolean;
  config?: {
    chatId?: string; // For telegram - override default
    imageField?: string; // Field path for image URL (e.g., "imageUrl", "artifactUrl")
    captionField?: string; // Field path for caption/text (e.g., "captions", "text")
  };
}

// Response mode for webhook-triggered jobs
export type WebhookResponseMode = "passthrough" | "template" | "confirmation";

export interface WebhookResponseConfig {
  mode: WebhookResponseMode;
  // For "template" mode - JSON template with variable placeholders
  // Available variables: {{payment.amount}}, {{payment.signature}}, {{payment.payer}}, {{payment.timestamp}}, {{inputs.*}}
  template?: string;
  // For "confirmation" mode - simple success message
  successMessage?: string;
}

export interface OutputConfig {
  destinations: OutputDestination[];
  // Webhook-specific response configuration
  webhookResponse?: WebhookResponseConfig;
}
