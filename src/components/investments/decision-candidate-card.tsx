import Link from "next/link";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { DecisionScoreBar } from "@/components/investments/decision-score-bar";
import { DataQualityBadge } from "@/components/investments/data-quality-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionCandidateView } from "@/lib/types";

export function DecisionCandidateCard({
  title,
  candidates,
  emptyText,
}: {
  title: string;
  candidates: DecisionCandidateView[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {candidates.length ? (
          candidates.map((candidate) => (
            <Link
              key={`${candidate.kind}-${candidate.symbol}`}
              href={`/portfolio/${candidate.symbol}`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-sm transition-colors hover:bg-accent/35"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{candidate.symbol}</p>
                  <DataQualityBadge label={candidate.confidenceLabel} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {candidate.reason} · {candidate.currentZone.replaceAll("_", " ")}
                </p>
                <DecisionScoreBar
                  score={candidate.score}
                  variant={candidate.kind === "accumulation" ? "accumulation" : "trim"}
                  compact
                />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground transition-colors group-hover:text-foreground">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                <ArrowRight className="size-4" aria-hidden="true" />
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-border/80 bg-muted/25 px-3 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
