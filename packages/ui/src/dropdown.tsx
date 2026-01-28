"use client";

import React, { useState, ReactNode, createContext, useContext } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  useHover,
} from "@floating-ui/react";
import { motion } from "framer-motion";
import clsx from "clsx";

// Context to allow DropdownItem to close the dropdown
const DropdownContext = createContext<{ close: () => void } | null>(null);

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Enable hover to open (in addition to click) */
  enableHover?: boolean;
  /** Hover delay in ms */
  hoverDelay?: number;
  className?: string;
}

// Animation variants based on placement
const getAnimationVariants = (placement: string) => {
  const isTop = placement.startsWith("top");
  return {
    initial: {
      opacity: 0,
      y: isTop ? 6 : -6,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth feel
      },
    },
    exit: {
      opacity: 0,
      y: isTop ? 6 : -6,
      transition: {
        duration: 0.1,
        ease: "easeOut",
      },
    },
  };
};

export function Dropdown({
  trigger,
  children,
  placement = "bottom-start",
  enableHover = false,
  hoverDelay = 150,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);
  const hover = useHover(context, {
    enabled: enableHover,
    delay: { open: 0, close: hoverDelay },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
    hover,
  ]);

  // Close dropdown on window resize (prevents dropdown from extending off-screen on mobile)
  React.useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      setIsOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  const variants = getAnimationVariants(placement);

  return (
    <>
      <div ref={refs.setReference} {...getReferenceProps()}>
        {trigger}
      </div>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50"
          >
            <DropdownContext.Provider value={{ close: () => setIsOpen(false) }}>
              <motion.div
                initial="initial"
                animate="animate"
                variants={variants}
                className={clsx(
                  "bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-lg py-1 flex flex-col",
                  className,
                )}
              >
                {children}
              </motion.div>
            </DropdownContext.Provider>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

interface DropdownItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  as?: React.ElementType;
  href?: string;
  /** Style variant: "default" for prominent items, "muted" for subtle/secondary items */
  variant?: "default" | "muted";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow any additional props for Link components
}

export function DropdownItem({
  children,
  onClick,
  className,
  active = false,
  as: Component,
  href,
  variant = "default",
  ...props
}: DropdownItemProps) {
  const dropdownContext = useContext(DropdownContext);

  const handleClick = () => {
    // Close dropdown first
    dropdownContext?.close();
    // Then call the onClick handler
    onClick?.();
  };

  const baseClassName = clsx(
    "w-full text-left transition-colors flex items-center",
    variant === "muted"
      ? "px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      : "px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground",
    active && "text-primary bg-primary/10",
    className,
  );

  // If href is provided, use anchor tag
  if (href && !Component) {
    return (
      <a href={href} className={baseClassName} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }

  // If Component is provided (like Link), use it
  if (Component) {
    return (
      <Component
        onClick={handleClick}
        className={baseClassName}
        href={href}
        {...props}
      >
        {children}
      </Component>
    );
  }

  // Default to button
  return (
    <button onClick={handleClick} className={baseClassName} {...props}>
      {children}
    </button>
  );
}

interface DropdownDividerProps {
  className?: string;
}

export function DropdownDivider({ className }: DropdownDividerProps) {
  return <div className={clsx("h-px bg-border my-1", className)} />;
}
