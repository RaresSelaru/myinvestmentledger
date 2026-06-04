import { AreaChart, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_28px_rgba(24,168,91,0.28)]",
        className
      )}
      aria-hidden="true"
    >
      <AreaChart className="absolute size-8 opacity-20" />
      <BookOpenCheck className="relative size-[1.375rem]" />
    </span>
  );
}
