import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/utils";
import { Spinner } from "./spinner";

// Check if className contains a padding override (px-, py-, p-, pl-, pr-, pt-, pb-)
const hasPaddingOverride = (className?: string) =>
  className && /\bp[xytblr]?-/.test(className);

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-black/5 dark:bg-white/10 text-secondary-foreground hover:bg-black/10 dark:hover:bg-white/15",
        ghost: "hover:bg-secondary/80",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-[36px]",
        sm: "h-7 rounded-md text-xs",
        lg: "min-h-[48px] rounded-md text-lg",
        xl: "min-h-[56px] rounded-lg text-xl font-bold",
        icon: "min-h-[36px] w-9",
        "icon-sm": "h-7 w-7 rounded",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Default padding per size (applied unless overridden)
const sizePadding: Record<string, string> = {
  default: "px-4",
  sm: "px-3",
  lg: "px-10",
  xl: "px-12",
};

type ButtonElement = HTMLButtonElement | HTMLAnchorElement;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  as?: React.ElementType;
  href?: string;
  target?: string;
  rel?: string;
  loading?: boolean;
}

const Button = React.forwardRef<ButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      as: Component = "button",
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    // Only apply default padding if className doesn't include a padding override
    const paddingClass = hasPaddingOverride(className)
      ? ""
      : sizePadding[size || "default"] || "px-4";

    return (
      <Component
        className={cn(
          buttonVariants({ variant, size }),
          paddingClass,
          className,
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner size="sm" className="text-current" /> : children}
      </Component>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
