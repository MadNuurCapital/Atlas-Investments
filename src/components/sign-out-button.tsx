import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";
import { cn } from "@/lib/cn";

export function SignOutButton({
  className,
  variant = "secondary",
  showLabel = true,
}: {
  className?: string;
  variant?: "secondary" | "ghost";
  showLabel?: boolean;
}) {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant={variant}
        size={showLabel ? "md" : "icon"}
        className={cn(className)}
        aria-label="Sign out"
      >
        <LogOut />
        {showLabel && "Sign out"}
      </Button>
    </form>
  );
}
