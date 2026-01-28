import Link from "next/link";
import clsx from "clsx";

interface LogoProps {
  showText?: boolean;
  href?: string;
  className?: string;
  /** Size variant - sm for header, lg for hero */
  size?: "sm" | "lg";
}

const sizeConfig = {
  sm: {
    size: 32,
    radius: 7,
    strokeWidth: 1.5,
  },
  lg: {
    size: 96,
    radius: 12,
    strokeWidth: 3,
  },
};

function LogoIcon({ size = "sm" }: { size?: "sm" | "lg" }) {
  const config = sizeConfig[size];
  const s = config.size;

  // Scale the lightning bolt path based on size
  // Base path is for 96x96, scale accordingly
  const scale = s / 96;
  const boltPath = `M${52 * scale} ${20 * scale}L${28 * scale} ${52 * scale}H${44 * scale}L${40 * scale} ${76 * scale}L${64 * scale} ${44 * scale}H${48 * scale}L${52 * scale} ${20 * scale}Z`;

  // Add shadow for larger logo
  const shadowClass = size === "lg" ? "shadow-xl shadow-primary/30" : "";

  return (
    <div
      className={clsx("relative", shadowClass)}
      style={{ width: s, height: s, borderRadius: config.radius }}
    >
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id={`logoGradient-${size}`}
            x1="0"
            y1="0"
            x2={s}
            y2={s}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#10b981" />
            <stop offset="1" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <rect
          width={s}
          height={s}
          rx={config.radius}
          fill={`url(#logoGradient-${size})`}
        />
        {/* Solid white lightning bolt */}
        <path d={boltPath} fill="white" />
      </svg>
    </div>
  );
}

export function Logo({
  showText = false,
  href = "/",
  className,
  size = "sm",
}: LogoProps) {
  const content = (
    <div className={clsx("flex items-center gap-2", className)}>
      <LogoIcon size={size} />
      {showText && (
        <span className="text-foreground font-display font-semibold text-xl">
          x402jobs
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
