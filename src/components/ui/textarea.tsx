import { TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "focus-ring w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted",
          hasError ? "border-danger" : "border-border",
          className
        )}
        aria-invalid={hasError || undefined}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
