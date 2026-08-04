import * as React from "react";
import { cn } from "@/lib/cn";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-[var(--border-strong)] bg-surface px-3 text-sm text-foreground",
        "placeholder:text-subtle-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-[invalid=true]:border-[var(--negative)]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A labelled field with optional hint and error text.
 *
 * Errors are wired with aria-describedby and aria-invalid so screen readers
 * announce them, rather than relying on red text alone.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-[var(--negative)]">
          {error}
        </p>
      )}
    </div>
  );
}
