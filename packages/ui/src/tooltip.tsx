"use client";

import React, { useState, ReactNode } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
  FloatingArrow,
} from "@floating-ui/react";
import { cn } from "./lib/utils";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Tooltip({
  children,
  content,
  position = "top",
  className = "",
  maxWidth = "sm",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = React.useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: position,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({
        fallbackAxisSideDirection: "start",
      }),
      shift({ padding: 8 }),
      arrow({
        element: arrowRef,
      }),
    ],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  const maxWidthClasses = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <>
      <div
        ref={refs.setReference}
        className={cn("inline-block", className)}
        {...getReferenceProps()}
      >
        {children}
      </div>
      <FloatingPortal>
        {isOpen && content && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999]"
            {...getFloatingProps()}
          >
            <div
              className={cn(
                "bg-gray-900 dark:bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-xl break-words whitespace-normal text-center",
                maxWidthClasses[maxWidth],
              )}
            >
              {content}
              <FloatingArrow
                ref={arrowRef}
                context={context}
                className="fill-gray-900 dark:fill-gray-800"
              />
            </div>
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
