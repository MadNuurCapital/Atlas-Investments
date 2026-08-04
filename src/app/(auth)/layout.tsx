import { AtlasLogo } from "@/components/brand/atlas-logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 pb-24">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <AtlasLogo size="lg" />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-surface p-6 shadow-sm">
            {children}
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-subtle-foreground">
        Internal system · Integrated Barakah Wealth Advisory
      </footer>
    </div>
  );
}
