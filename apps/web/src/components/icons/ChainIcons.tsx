import { getNetwork } from "@/lib/networks";

interface IconProps {
  className?: string;
}

export function SolanaIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 397.7 311.7" className={className} fill="currentColor">
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
    </svg>
  );
}

export function BaseIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 111 111" className={className} fill="currentColor">
      <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" />
    </svg>
  );
}

// Helper to get the right icon for a network
// Supports both v1 ("base") and CAIP-2 ("eip155:8453") formats
export function ChainIcon({
  network,
  className,
}: {
  network?: string | null;
  className?: string;
}) {
  const networkConfig = getNetwork(network);
  if (networkConfig.id === "base") {
    return <BaseIcon className={className} />;
  }
  return <SolanaIcon className={className} />;
}
