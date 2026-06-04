import { commitStagedImportAction, dryRunImportAction } from "@/app/(platform)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportReportForm } from "@/components/investments/import-report-form";
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

      <ImportReportForm
        portfolio={workspace.activePortfolio}
        brokerAccounts={workspace.brokerAccounts}
        isLocked={workspace.isLocked}
        stagedImportId={first(params.stagedImportId)}
        result={{
          message: first(params.message),
          parsed: first(params.parsed),
          lots: first(params.lots),
          cash: first(params.cash),
          transactions: first(params.transactions),
        }}
        dryRunAction={dryRunImportAction}
        commitAction={commitStagedImportAction}
      />

      {first(params.error) ? (
        <p className="max-w-3xl rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {first(params.error)}
        </p>
      ) : null}

      {first(params.message) ? (
        <Card className="max-w-3xl">
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
