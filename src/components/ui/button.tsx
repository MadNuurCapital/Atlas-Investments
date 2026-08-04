import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand-500)] text-white hover:bg-[var(--brand-600)] active:bg-[var(--brand-700)]",
        secondary:
          "border border-[var(--border-strong)] bg-surface text-foreground hover:bg-surface-sunken",
        ghost: "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
        destructive:
          "bg-[var(--negative)] text-white hover:opacity-90",
        link: "text-[var(--brand-500)] underline-offset-4 hover:underline dark:text-[var(--brand-400)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
