import { AreaChart, BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20",
        className
      )}
      aria-hidden="true"
    >
      <AreaChart className="absolute size-7 opacity-25" />
      <BookOpenCheck className="relative size-5" />
    </span>
  );
}
