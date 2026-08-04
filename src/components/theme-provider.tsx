"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light/dark theming.
 *
 * `attribute="class"` writes `.dark` on <html>, which is what the
 * @custom-variant in globals.css keys off. next-themes injects a small
 * inline script so the correct theme is applied before first paint —
 * without it, a dark-mode user gets a white flash on every page load.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
