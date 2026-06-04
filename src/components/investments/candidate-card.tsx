import { SlidersHorizontal } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { SignedPercent } from "@/components/investments/signed-value";
import { formatMoneyPrecise, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/lib/types";

export function CandidateCard({
  title,
  candidates,
}: {
  title: string;
  candidates: Candidate[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.length ? (
          candidates.map((candidate) => (
            <Sheet key={`${candidate.kind}-${candidate.symbol}`}>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3.5 transition-colors hover:bg-accent/35">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{candidate.symbol}</p>
                    <span className="metric-tabular text-xs text-muted-foreground">
                      score {candidate.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatPercent(candidate.actualAllocation)}</span>
                    <span>target {formatPercent(candidate.targetAllocation)}</span>
                    <SignedPercent value={candidate.drift} context="drift" />
                  </div>
                </div>
                <SheetTrigger
                  className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                  aria-label={`Explain ${candidate.symbol}`}
                >
                  <SlidersHorizontal className="size-4" />
                </SheetTrigger>
              </div>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>{candidate.symbol}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Detail label="Actual allocation" value={formatPercent(candidate.actualAllocation)} />
                    <Detail label="Target allocation" value={formatPercent(candidate.targetAllocation)} />
                    <Detail label="Drift" value={<SignedPercent value={candidate.drift} context="drift" />} />
                    <Detail
                      label="Current price"
                      value={formatMoneyPrecise(candidate.currentPrice, "USD")}
                    />
                    <Detail
                      label="Target price"
                      value={
                        candidate.targetPrice
                          ? formatMoneyPrecise(candidate.targetPrice, "USD")
                          : "-"
                      }
                    />
                    <Detail label="Score" value={candidate.score.toFixed(1)} />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Factors</p>
                    {candidate.factors.map((factor) => (
                      <div
                        key={factor.label}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <span className="text-muted-foreground">{factor.label}</span>
                        <span className="metric-tabular font-medium">{factor.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border/80 bg-white/70 px-3 py-8 text-center text-sm text-muted-foreground">
            No candidates from current data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-muted/45 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 metric-tabular font-medium">{value}</div>
    </div>
  );
}
