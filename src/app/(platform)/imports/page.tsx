import { commitStagedImportAction, dryRunImportAction } from "@/app/(platform)/actions";
import { ImportReportForm } from "@/components/investments/import-report-form";
import { PageHeader } from "@/components/investments/page-header";
import { getWorkspaceShellData } from "@/lib/data";

type ImportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const workspace = await getWorkspaceShellData();
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
          newRows: first(params.newRows),
          duplicates: first(params.duplicates),
          updated: first(params.updated),
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
    </div>
  );
}
