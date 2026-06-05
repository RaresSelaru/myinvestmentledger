import { StrategyTargetsForm } from "@/components/investments/strategy-targets-form";
import { getStrategyData } from "@/lib/data";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type StrategyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StrategyPage({ searchParams }: StrategyPageProps) {
  const workspace = await getStrategyData();
  const params = await searchParams;
  const targetTotal = workspace.holdings.reduce(
    (total, holding) => total + holding.targetAllocation,
    0
  );
  const coreTotal = workspace.holdings.length
    ? workspace.holdings.reduce((total, holding) => total + holding.corePercent, 0) /
      workspace.holdings.length
    : 0;
  const configured = workspace.holdings.filter(
    (holding) => holding.targetConfigured
  ).length;

  return (
    <div className="space-y-5">
      {first(params.error) ? (
        <p className="rounded-3xl border border-destructive/25 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          {first(params.error)}
        </p>
      ) : null}
      {first(params.message) ? (
        <p className="rounded-3xl border border-primary/25 bg-primary/10 px-5 py-4 text-sm text-primary">
          {first(params.message)}
        </p>
      ) : null}

      <section className="flex flex-wrap gap-3">
        <MiniStat label="Symbols" value={String(workspace.holdings.length)} />
        <MiniStat label="Configured" value={`${configured}/${workspace.holdings.length}`} />
        <MiniStat
          label="Target total"
          value={formatPercent(targetTotal)}
          attention={targetTotal > 100}
        />
        <MiniStat label="Average core" value={formatPercent(coreTotal)} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Target allocation</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Set only the essentials first. Expand a symbol when you want to tune
            anchors, zones, or decision inputs.
          </p>
        </div>
        <StrategyTargetsForm
          portfolioId={workspace.activePortfolio.id}
          holdings={workspace.holdings}
          isLocked={workspace.isLocked}
        />
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="rounded-full border border-border/70 bg-card px-4 py-2 shadow-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "ml-2 metric-tabular text-sm font-semibold",
          attention ? "text-rose-700 dark:text-rose-300" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
