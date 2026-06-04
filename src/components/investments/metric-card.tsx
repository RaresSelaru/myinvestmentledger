import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
  explain,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  explain?: ReactNode;
}) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-lg shadow-black/10">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          {explain}
        </div>
        <div className="mt-5 text-2xl font-semibold tracking-tight metric-tabular">
          {value}
        </div>
        {detail ? (
          <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
