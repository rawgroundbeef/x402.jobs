import * as React from "react";
import { Input, type InputProps } from "./input";
import { Label } from "./label";
import { cn } from "./lib/utils";

export interface TextFieldProps extends InputProps {
  label?: string;
  error?: string;
  helperText?: string;
}

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const hasError = !!error;

    return (
      <div className="space-y-1">
        {label && (
          <Label
            htmlFor={inputId}
            className={cn(hasError && "text-destructive")}
          >
            {label}
          </Label>
        )}
        <Input
          ref={ref}
          id={inputId}
          className={cn(
            hasError && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          aria-invalid={hasError}
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-destructive mt-0.5"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-muted-foreground mt-0.5"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
TextField.displayName = "TextField";

export { TextField };
