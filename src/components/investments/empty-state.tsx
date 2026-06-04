import Link from "next/link";
import { ArrowDownToLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  isLocked = false,
}: {
  title: string;
  description: string;
  isLocked?: boolean;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-white px-6 py-12 text-center shadow-[0_18px_55px_rgba(15,35,34,0.06)]">
      <div className="soft-green-icon size-14">
        <ArrowDownToLine className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={isLocked ? "/login" : "/imports"}>
            <ArrowDownToLine className="size-4" aria-hidden="true" />
            {isLocked ? "Log in" : "Import report"}
          </Link>
        </Button>
        {!isLocked ? (
          <Button asChild variant="outline">
            <Link href="/transactions">
              <Plus className="size-4" aria-hidden="true" />
              Manual entry
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
