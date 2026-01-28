import { Box } from "lucide-react";
import { GoogleIcon } from "./SocialIcons";

interface IconProps {
  className?: string;
}

// Anthropic Claude - Orange #D97706
export function AnthropicIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M14.5 2L18.5 14L22.5 2H24L19 22H17L12 6L7 22H5L0 2H1.5L5.5 14L9.5 2H11L15 14L19 2H14.5Z" />
    </svg>
  );
}

// OpenAI - Black/white (uses currentColor)
export function OpenAIIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

// Meta Llama - Blue #0668E1
export function MetaIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Mistral AI - Orange #F7A81B
export function MistralIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="0" y="0" width="8" height="8" />
      <rect x="0" y="8" width="8" height="8" />
      <rect x="8" y="8" width="8" height="8" />
      <rect x="8" y="16" width="8" height="8" />
      <rect x="16" y="8" width="8" height="8" />
    </svg>
  );
}

// X.AI Grok - Neutral gray
export function XAIIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Stability AI - Purple #7C3AED
export function StabilityIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="5" r="3" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="19" r="3" />
      <circle cx="5" cy="8.5" r="2" />
      <circle cx="19" cy="8.5" r="2" />
      <circle cx="5" cy="15.5" r="2" />
      <circle cx="19" cy="15.5" r="2" />
    </svg>
  );
}

// Cohere - Orange #F97316
export function CohereIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

// Default provider icon for unknown providers
function DefaultProviderIcon({ className = "w-5 h-5" }: IconProps) {
  return <Box className={className} />;
}

/**
 * Helper component that renders the appropriate provider icon
 * with fallback for unknown providers
 */
export function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const normalized = provider.toLowerCase();

  if (normalized === "anthropic")
    return <AnthropicIcon className={className} />;
  if (normalized === "openai") return <OpenAIIcon className={className} />;
  if (normalized === "google") return <GoogleIcon className={className} />;
  if (normalized === "meta" || normalized === "meta-llama")
    return <MetaIcon className={className} />;
  if (normalized === "mistralai" || normalized === "mistral")
    return <MistralIcon className={className} />;
  if (normalized === "x-ai" || normalized === "xai")
    return <XAIIcon className={className} />;
  if (normalized.includes("stability"))
    return <StabilityIcon className={className} />;
  if (normalized === "cohere") return <CohereIcon className={className} />;

  // Fallback for unknown providers
  return <DefaultProviderIcon className={className} />;
}
