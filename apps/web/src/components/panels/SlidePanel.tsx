"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@x402jobs/ui/utils";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Header right content (e.g. status badge) */
  headerRight?: React.ReactNode;
  /** Subheader content (e.g. tabs) - sticky below the header */
  subheader?: React.ReactNode;
  /** Footer content (e.g. action buttons) - sticky at the bottom */
  footer?: React.ReactNode;
  /** Full-bleed content (no padding) */
  fullBleed?: boolean;
  /** Stack level for layered panels (0 = base, 1+ = stacked on top) */
  stackLevel?: number;
  /** Is there a panel stacked on top of this one? Used to push this panel back. */
  hasStackedChild?: boolean;
  /** Hide this panel visually (used when 3+ panels are stacked - only show top 2) */
  isHidden?: boolean;
  /** Called when clicked while pushed back (hasStackedChild) - use to close child panel */
  onBringToFront?: () => void;
}

/**
 * A floating panel that slides up from the bottom-right of the canvas.
 * Creates a "stack of papers" effect where panels push previous ones back.
 * Uses Framer Motion for smooth animations.
 */
export function SlidePanel({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  headerRight,
  subheader,
  footer,
  fullBleed = false,
  stackLevel = 0,
  hasStackedChild = false,
  isHidden = false,
  onBringToFront,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Trap focus when open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Calculate z-index based on stack level
  const zIndex = 50 + stackLevel * 10;

  // Stack offset - push panel back when there's a child stacked on top
  const stackOffsetX = 28; // px to push left
  const stackOffsetY = 43; // px to push down

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Floating Panel - slides up from bottom, no backdrop */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{
              y: isHidden
                ? stackOffsetY * 2
                : hasStackedChild
                  ? stackOffsetY
                  : 0,
              opacity: isHidden ? 0 : 1,
              x: isHidden
                ? -stackOffsetX * 2
                : hasStackedChild
                  ? -stackOffsetX
                  : 0,
              scale: isHidden ? 0.95 : hasStackedChild ? 0.98 : 1,
            }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              mass: 0.8,
            }}
            onClick={
              hasStackedChild && onBringToFront && !isHidden
                ? onBringToFront
                : undefined
            }
            className={cn(
              "fixed bg-background border border-border border-b-0",
              "flex flex-col shadow-2xl outline-none overflow-hidden",
              // Responsive: full width on small screens, floating on larger
              "inset-x-0 top-[53px] rounded-t-lg", // Mobile: full width below header
              "md:inset-x-auto md:top-[16%] md:right-[9%] md:w-[44%] md:rounded-t-xl", // Desktop: floating
              // Dim when pushed back
              hasStackedChild && !isHidden && "brightness-[0.85]",
              // Hide pointer events when hidden
              isHidden && "pointer-events-none",
              // Cursor pointer when clickable to bring to front
              hasStackedChild &&
                onBringToFront &&
                !isHidden &&
                "cursor-pointer",
            )}
            style={{
              zIndex,
              bottom: 0,
              // Additional offset based on stack level (for deeply nested stacks)
              marginTop: stackLevel * stackOffsetY,
            }}
          >
            {/* Header */}
            <div
              className={cn(
                "relative flex items-start justify-between px-5 py-5 flex-shrink-0",
                !subheader && "border-b border-border",
              )}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0 pr-8">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="font-semibold text-foreground truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>
              {/* Close button - absolute top right */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {headerRight}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Subheader (e.g. tabs) - sticky below header */}
            {subheader && (
              <div className="flex-shrink-0 border-b border-border bg-background">
                {subheader}
              </div>
            )}

            {/* Content */}
            <div className={cn("flex-1 overflow-y-auto", !fullBleed && "p-4")}>
              {children}
            </div>

            {/* Footer - sticky at bottom */}
            {footer && (
              <div className="flex-shrink-0 border-t border-border bg-background px-4 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
