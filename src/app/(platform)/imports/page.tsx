import { dryRunImportAction, uploadImportAction } from "@/app/(platform)/actions";
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
import { PageHeader } from "@/components/investments/page-header";
import { getWorkspaceData } from "@/lib/data";

type ImportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const workspace = await getWorkspaceData();
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imports"
        description="Upload XTB Excel reports and keep broker source files private."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">XTB report</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={uploadImportAction} className="space-y-4">
            <input
              type="hidden"
              name="portfolioId"
              value={workspace.activePortfolio.id}
            />
            <div className="space-y-2">
              <Label>Broker account</Label>
              <Select name="brokerAccountId" defaultValue={workspace.brokerAccounts[0]?.id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {workspace.brokerAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Excel file</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" formAction={dryRunImportAction} variant="outline">
                Dry run
              </Button>
              <Button type="submit" formAction={uploadImportAction}>
                Import report
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {first(params.error) ? (
        <p className="max-w-2xl rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {first(params.error)}
        </p>
      ) : null}

      {first(params.message) ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Import result</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
            <Result label="New rows" value={first(params.newRows) ?? "0"} />
            <Result label="Duplicates ignored" value={first(params.duplicates) ?? "0"} />
            <Result label="Updated rows" value={first(params.updated) ?? "0"} />
            <Result label="Result" value={first(params.message) ?? "Stored"} />
            {first(params.parsed) ? (
              <>
                <Result label="Parsed rows" value={first(params.parsed) ?? "0"} />
                <Result label="Lots" value={first(params.lots) ?? "0"} />
                <Result label="Cash rows" value={first(params.cash) ?? "0"} />
                <Result
                  label="Transactions"
                  value={first(params.transactions) ?? "0"}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 metric-tabular font-medium">{value}</p>
    </div>
  );
}
