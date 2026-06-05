import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
  explain,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  explain?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="min-h-28 border-border/70 bg-card">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon ? (
              <span className="soft-green-icon size-10">{icon}</span>
            ) : null}
            <p className="text-xs leading-5 text-muted-foreground">{label}</p>
          </div>
          <div className="-mr-1 -mt-1">{explain}</div>
        </div>
        <div className="mt-3 whitespace-nowrap text-xl font-semibold tracking-tight metric-tabular text-foreground">
          {value}
        </div>
        {detail ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
