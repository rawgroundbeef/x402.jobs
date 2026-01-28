"use client";

import { ReactNode, useRef, useEffect, useState } from "react";

interface LoadingBorderProps {
  children: ReactNode;
  isLoading: boolean;
  className?: string;
  /** Border radius in pixels */
  borderRadius?: number;
}

/**
 * A wrapper component that shows a single radar line traveling around the border when loading.
 * Uses a gradient that cycles through teal, cyan, blue, and purple.
 */
export function LoadingBorder({
  children,
  isLoading,
  className = "",
  borderRadius = 8,
}: LoadingBorderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [perimeter, setPerimeter] = useState(600);
  const [dimensions, setDimensions] = useState({ width: 200, height: 100 });

  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
      // Approximate perimeter of rounded rect
      const p =
        2 * (width + height) - 8 * borderRadius + 2 * Math.PI * borderRadius;
      setPerimeter(Math.round(p));
    }
  }, [borderRadius]);

  // Single dash length and gap to ensure only ONE line shows
  const dashLength = 40;
  const gapLength = perimeter - dashLength;
  const gradientId = `loading-gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Loading border SVG overlay */}
      {isLoading && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2={dimensions.width}
              y2={dimensions.height}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#10b981">
                <animate
                  attributeName="stop-color"
                  values="#10b981;#14b8a6;#06b6d4;#3b82f6;#8b5cf6;#10b981"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor="#06b6d4">
                <animate
                  attributeName="stop-color"
                  values="#06b6d4;#3b82f6;#8b5cf6;#10b981;#14b8a6;#06b6d4"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="#8b5cf6">
                <animate
                  attributeName="stop-color"
                  values="#8b5cf6;#10b981;#14b8a6;#06b6d4;#3b82f6;#8b5cf6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          {/* Single radar line with gradient */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            rx={borderRadius}
            ry={borderRadius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            strokeDasharray={`${dashLength} ${gapLength}`}
            strokeLinecap="round"
          >
            <animate
              attributeName="stroke-dashoffset"
              values={`${perimeter};0`}
              dur="1.5s"
              repeatCount="indefinite"
            />
          </rect>
        </svg>
      )}

      {children}
    </div>
  );
}
