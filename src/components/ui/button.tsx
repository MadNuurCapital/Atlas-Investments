import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * The primary button changes colour with the theme, and does so on purpose.
 *
 * Light mode: deep Atlas Blue with white text — about 6.4:1.
 * Dark mode:  gold with near-black navy text — about 11:1.
 *
 * Gold on a light background is roughly 1.4:1, so a gold button on the light
 * theme would be a decorative element that nobody could read. The accent
 * still leads the eye on light screens, through the active nav marker, the
 * chart lines, the section rules and the glow on the headline figure — all
 * places where it sits on ink rather than replacing it.
 *
 * Both variants take their colours from `--primary-*` in globals.css, so the
 * decision lives with the rest of the palette rather than here.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] text-sm font-medium transition-[background-color,box-shadow,transform,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 whitespace-nowrap active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary-bg)] text-[var(--primary-fg)] shadow-[var(--primary-shadow)] hover:bg-[var(--primary-bg-hover)]",
        secondary:
          "border border-[var(--border-strong)] bg-[var(--surface-glass)] text-foreground backdrop-blur-sm hover:border-[var(--accent-gold)]/40 hover:bg-surface-sunken",
        ghost: "text-muted-foreground hover:bg-surface-sunken hover:text-foreground",
        destructive:
          "bg-[var(--destructive-bg)] text-[var(--destructive-fg)] hover:opacity-90",
        link: "text-[var(--brand-500)] underline-offset-4 hover:underline dark:text-[var(--accent-gold)]",
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

/**
 * A link styled as a button.
 *
 * Kept as a separate component rather than an `asChild` prop on Button: a
 * navigation control should render an anchor so it keeps middle-click,
 * open-in-new-tab and the correct role for assistive technology.
 */
export function LinkButton({
  className,
  variant,
  size,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof buttonVariants>) {
  return (
    <a className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
