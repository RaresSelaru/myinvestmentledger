import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/investments/page-header";
import { StrategyTargetsForm } from "@/components/investments/strategy-targets-form";
import { getStrategyData } from "@/lib/data";
import { formatPercent } from "@/lib/format";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy"
        description="Allocation targets, target prices, and core/satellite discipline."
      />

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

      <section className="grid gap-4 md:grid-cols-3">
        <MiniStat label="Symbols" value={String(workspace.holdings.length)} />
        <MiniStat label="Target total" value={formatPercent(targetTotal)} />
        <MiniStat label="Average core" value={formatPercent(coreTotal)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StrategyTargetsForm
              portfolioId={workspace.activePortfolio.id}
              holdings={workspace.holdings}
              isLocked={workspace.isLocked}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm">
                <p className="font-semibold">{workspace.activePortfolio.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Base currency: {workspace.activePortfolio.baseCurrency}
                </p>
                {workspace.activePortfolio.tags.length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {workspace.activePortfolio.tags.join(" · ")}
                  </p>
                ) : null}
              </div>
              <div className="rounded-3xl border border-border/70 bg-muted/35 p-5 text-sm text-muted-foreground">
                Technical configuration, live prices, API keys, and cash overrides live in Settings.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Broker accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace.brokerAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-border/70 bg-white p-4 text-sm shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{account.name}</p>
                    <span className="metric-tabular text-muted-foreground">
                      {account.baseCurrency}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{account.broker}</p>
                </div>
              ))}
              <Separator />
              <p className="text-sm text-muted-foreground">
                Internal transfer links are modeled in the database so movement
                between broker accounts does not become a new consolidated deposit.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 metric-tabular text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
