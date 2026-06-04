import {
  deleteMarketDataApiKeyAction,
  refreshPortfolioQuotesAction,
  saveBrokerCashOverrideAction,
  saveMarketDataApiKeyAction,
  testMarketDataProviderAction,
  updateMarketDataSettingsAction,
} from "@/app/(platform)/actions";
import { PageHeader } from "@/components/investments/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getSettingsData } from "@/lib/data";
import type { MarketDataProviderName } from "@/lib/types";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PROVIDERS: Array<{ value: MarketDataProviderName; label: string }> = [
  { value: "finnhub", label: "Finnhub" },
  { value: "fmp", label: "Financial Modeling Prep" },
  { value: "alpha_vantage", label: "Alpha Vantage" },
  { value: "twelve_data", label: "Twelve Data" },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const workspace = await getSettingsData();
  const params = await searchParams;
  const keyByProvider = new Map(
    workspace.apiKeys.map((key) => [key.provider, key])
  );
  const overrideByBroker = new Map(
    workspace.cashOverrides.map((override) => [override.brokerAccountId, override])
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Market data, valuation mode, API keys, and cash overrides."
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

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Valuation mode</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateMarketDataSettingsAction} className="space-y-5">
              <input
                type="hidden"
                name="portfolioId"
                value={workspace.activePortfolio.id}
              />
              <label className="flex items-start gap-3 rounded-3xl border border-border/70 bg-muted/35 p-5">
                <input
                  type="checkbox"
                  name="livePricesEnabled"
                  defaultChecked={workspace.marketDataSettings.livePricesEnabled}
                  disabled={workspace.isLocked}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Enable live prices</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Uses cached quotes for holdings. Cash remains from broker snapshot
                    or manual override.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valuation mode</Label>
                  <Select
                    name="valuationMode"
                    defaultValue={workspace.marketDataSettings.valuationMode}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="import_snapshot">Import snapshot</SelectItem>
                      <SelectItem value="live_prices">Live prices</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred provider</Label>
                  <Select
                    name="preferredProvider"
                    defaultValue={workspace.marketDataSettings.preferredProvider}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto fallback</SelectItem>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" size="lg" disabled={workspace.isLocked}>
                  Save settings
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  variant="outline"
                  formAction={refreshPortfolioQuotesAction}
                  disabled={workspace.isLocked}
                >
                  Refresh quotes now
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">API keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PROVIDERS.map((provider) => {
              const status = keyByProvider.get(provider.value);

              return (
                <div
                  key={provider.value}
                  className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{provider.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {status?.keyLast4
                          ? `Saved key ending in ${status.keyLast4}`
                          : "No user key saved"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={testMarketDataProviderAction}>
                        <input type="hidden" name="provider" value={provider.value} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={workspace.isLocked}
                        >
                          Test
                        </Button>
                      </form>
                      {status?.keyLast4 ? (
                        <form action={deleteMarketDataApiKeyAction}>
                          <input type="hidden" name="provider" value={provider.value} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            disabled={workspace.isLocked}
                          >
                            Remove
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <form action={saveMarketDataApiKeyAction} className="mt-4 flex gap-2">
                    <input type="hidden" name="provider" value={provider.value} />
                    <Input
                      name="apiKey"
                      type="password"
                      placeholder="Paste API key"
                      disabled={workspace.isLocked}
                    />
                    <Button type="submit" disabled={workspace.isLocked}>
                      Save
                    </Button>
                  </form>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Market data providers do not know broker cash. Use the XTB snapshot by
            default or set a manual override for a broker account.
          </p>
          <Separator />
          <div className="grid gap-3 lg:grid-cols-2">
            {workspace.brokerAccounts.map((account) => {
              const override = overrideByBroker.get(account.id);

              return (
                <form
                  key={account.id}
                  action={saveBrokerCashOverrideAction}
                  className="rounded-3xl border border-border/70 bg-white p-5 shadow-sm"
                >
                  <input type="hidden" name="portfolioId" value={workspace.activePortfolio.id} />
                  <input type="hidden" name="brokerAccountId" value={account.id} />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Default source: latest XTB cash snapshot
                      </p>
                    </div>
                    <span className="metric-tabular text-sm text-muted-foreground">
                      {account.baseCurrency}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px]">
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      placeholder="Manual cash amount"
                      defaultValue={override?.amount ?? ""}
                      disabled={workspace.isLocked}
                    />
                    <Select
                      name="currency"
                      defaultValue={override?.currency ?? account.baseCurrency}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RON">RON</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    name="comment"
                    className="mt-3"
                    placeholder="Optional note"
                    defaultValue={override?.comment ?? ""}
                    disabled={workspace.isLocked}
                  />
                  <Button
                    className="mt-3"
                    type="submit"
                    variant="outline"
                    disabled={workspace.isLocked}
                  >
                    Save override
                  </Button>
                </form>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
