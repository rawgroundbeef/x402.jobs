"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "./lib/utils";

interface MobileDrawerProps {
  children: React.ReactNode;
  /** Breakpoint at which to hide the drawer (default: "lg") */
  breakpoint?: "sm" | "md" | "lg" | "xl";
  /** Position of the drawer (default: "left") */
  position?: "left" | "right";
  /** Button position (default: "bottom-left") */
  buttonPosition?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Button color (default: "blue") */
  buttonColor?: "blue" | "red" | "green" | "purple" | "gray";
  /** Custom button class */
  buttonClassName?: string;
  /** Custom drawer class */
  drawerClassName?: string;
  /** Drawer width (default: "w-80") */
  drawerWidth?: string;
  /** External open state control */
  isOpen?: boolean;
  /** External open state setter */
  onOpenChange?: (open: boolean) => void;
  /** Z-index for the button (default: 60) */
  buttonZIndex?: number;
  /** Z-index for the drawer and backdrop (default: 55) */
  drawerZIndex?: number;
}

const buttonColorClasses = {
  blue: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700",
  red: "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
  green:
    "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700",
  purple:
    "bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700",
  gray: "bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-800",
};

const buttonPositionClasses = {
  "bottom-left": "bottom-6 left-6",
  "bottom-right": "bottom-6 right-6",
  "top-left": "top-6 left-6",
  "top-right": "top-6 right-6",
};

export function MobileDrawer({
  children,
  breakpoint = "lg",
  position = "left",
  buttonPosition = "bottom-left",
  buttonColor = "blue",
  buttonClassName,
  drawerClassName,
  drawerWidth = "w-80",
  isOpen: controlledIsOpen,
  onOpenChange,
  buttonZIndex = 60,
  drawerZIndex = 55,
}: MobileDrawerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen =
    controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;

  const toggleDrawer = () => setIsOpen(!isOpen);
  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeDrawer();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeDrawer]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Map breakpoints to explicit Tailwind classes so JIT compiler can detect them
  const breakpointHiddenClass =
    {
      sm: "sm:hidden",
      md: "md:hidden",
      lg: "lg:hidden",
      xl: "xl:hidden",
    }[breakpoint] || "lg:hidden";

  const drawerPositionClass = position === "left" ? "left-0" : "right-0";

  return (
    <>
      {/* Mobile Menu Button - Only visible below breakpoint */}
      <button
        onClick={toggleDrawer}
        className={cn(
          "block",
          breakpointHiddenClass,
          "fixed p-4 text-white rounded-full shadow-lg transition-colors",
          buttonPositionClasses[buttonPosition],
          buttonColorClasses[buttonColor],
          buttonClassName,
        )}
        style={{ zIndex: buttonZIndex }}
        aria-label="Toggle navigation"
        aria-expanded={isOpen}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className={cn(breakpointHiddenClass, "fixed inset-0 bg-black/50")}
            style={{ zIndex: drawerZIndex }}
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer */}
          <div
            className={cn(
              breakpointHiddenClass,
              "fixed inset-y-0 max-w-[85vw] bg-white dark:bg-gray-950 overflow-y-auto shadow-xl",
              drawerPositionClass,
              drawerWidth,
              drawerClassName,
            )}
            style={{ zIndex: drawerZIndex }}
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">{children}</div>
          </div>
        </>
      )}
    </>
  );
}
