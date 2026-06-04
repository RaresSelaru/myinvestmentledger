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
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed bg-card/80 px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <ArrowDownToLine className="size-4" aria-hidden="true" />
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
