import { cn } from "@/lib/utils";

export function ScoutLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-sans font-semibold tracking-[-0.045em] text-off",
        className,
      )}
    >
      scout
      <span className="text-lime">/</span>
      gaming
    </span>
  );
}
