import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CoreSatelliteBar } from "@/components/investments/core-satellite-bar";
import { PageHeader } from "@/components/investments/page-header";
import { getWorkspaceData } from "@/lib/data";

export default async function StrategyPage() {
  const workspace = await getWorkspaceData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy"
        description="Targets, broker accounts, transfer links, and personal assumptions."
      />

      <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Target allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspace.holdings.length ? (
              workspace.holdings.map((holding) => (
                <div
                  key={holding.symbol}
                  className="grid gap-3 rounded-md border p-3 md:grid-cols-[90px_repeat(5,minmax(0,1fr))]"
                >
                  <div>
                    <p className="font-medium">{holding.symbol}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {holding.companyName}
                    </p>
                  </div>
                  <Field label="Target %" value={holding.targetAllocation} />
                  <Field label="Max %" value={holding.maxAllocation ?? ""} />
                  <Field label="Buy price" value={holding.targetBuyPrice ?? ""} />
                  <Field label="Trim price" value={holding.targetSellPrice ?? ""} />
                  <div className="space-y-2">
                    <Label className="text-xs">Core/Satellite</Label>
                    <CoreSatelliteBar
                      core={holding.corePercent}
                      satellite={holding.satellitePercent}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Targets can be added once holdings or symbols exist.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Base currency</Label>
                <Input defaultValue={workspace.activePortfolio.baseCurrency} maxLength={3} />
              </div>
              <div className="space-y-2">
                <Label>Risk assumption</Label>
                <Textarea rows={4} placeholder="Optional personal assumption" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Broker accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace.brokerAccounts.map((account) => (
                <div key={account.id} className="rounded-md border p-3 text-sm">
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

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input defaultValue={value} inputMode="decimal" />
    </div>
  );
}
