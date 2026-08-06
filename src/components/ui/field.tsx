import * as React from "react";
import { cn } from "@/lib/cn";

/*
 * `bg-surface-sunken` rather than `bg-surface`: on a glass panel a control
 * that matches the panel disappears into it. Recessing the control instead of
 * raising it keeps the panel reading as one continuous sheet.
 */
const CONTROL_CLASSES =
  "w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-surface-sunken px-3 text-sm text-foreground " +
  "transition-[border-color,box-shadow] duration-150 " +
  "placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-60 " +
  "hover:border-[var(--border-strong)]/80 " +
  "focus:border-[var(--accent-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)]/25 " +
  "aria-[invalid=true]:border-[var(--negative)] aria-[invalid=true]:focus:ring-[var(--negative)]/25";

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
  return <input className={cn(CONTROL_CLASSES, "h-9", className)} {...props} />;
}

/**
 * Money input.
 *
 * `inputMode="decimal"` gives a numeric keypad without the spinner arrows and
 * scroll-wheel hazard of `type="number"`, where an accidental scroll over a
 * focused field silently changes a client's portfolio value.
 */
export function MoneyInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle-foreground">
        S$
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(CONTROL_CLASSES, "tabular h-9 pl-9", className)}
        {...props}
      />
    </div>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(CONTROL_CLASSES, "min-h-24 py-2", className)} {...props} />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL_CLASSES, "h-9", className)} {...props}>
      {children}
    </select>
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
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-[var(--negative)]" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          className="text-xs font-medium text-[var(--negative)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}
