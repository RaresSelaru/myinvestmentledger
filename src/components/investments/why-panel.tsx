import { DataQualityBadge } from "@/components/investments/data-quality-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DecisionScoreView } from "@/lib/types";
import type { ReactNode } from "react";

export function WhyPanel({ decision }: { decision?: DecisionScoreView | null }) {
  if (!decision) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recalculate the decision engine after setting strategy inputs to see explanations.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeGates = decision.gates.filter((gate) => gate.active);
  const missingCount =
    decision.missingData.critical.length + decision.missingData.nonCritical.length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Why</CardTitle>
        <DataQualityBadge label={decision.confidenceLabel} missingCount={missingCount} />
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium">Positive drivers</p>
          {decision.positiveDrivers.length ? (
            decision.positiveDrivers.map((driver) => (
              <Line key={driver.label} label={driver.label} value={driver.value} />
            ))
          ) : (
            <MutedLine>No strong positive driver yet.</MutedLine>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Review drivers</p>
          {decision.negativeDrivers.length ? (
            decision.negativeDrivers.map((driver) => (
              <Line key={driver.label} label={driver.label} value={driver.value} />
            ))
          ) : (
            <MutedLine>No review driver yet.</MutedLine>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Gates</p>
          {activeGates.length ? (
            activeGates.map((gate) => (
              <div key={gate.name} className="rounded-2xl border border-border/70 bg-muted/25 p-3">
                <p className="font-medium">{gate.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{gate.effect}</p>
              </div>
            ))
          ) : (
            <MutedLine>No active gate.</MutedLine>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Missing data</p>
          {missingCount ? (
            [...decision.missingData.critical, ...decision.missingData.nonCritical]
              .slice(0, 6)
              .map((item) => <MutedLine key={item}>{item.replaceAll("_", " ")}</MutedLine>)
          ) : (
            <MutedLine>No required missing input.</MutedLine>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="metric-tabular font-medium">{value}</span>
    </div>
  );
}

function MutedLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
