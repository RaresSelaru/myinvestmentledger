import { ManualEntryDialog } from "@/components/investments/manual-entry-dialog";
import { TransactionsTable } from "@/components/investments/transactions-table";
import { getActivityData } from "@/lib/data";

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TransactionsPage({
  searchParams,
}: TransactionsPageProps) {
  const workspace = await getActivityData();
  const params = await searchParams;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ManualEntryDialog
          portfolio={workspace.activePortfolio}
          brokerAccounts={workspace.brokerAccounts}
          isLocked={workspace.isLocked}
        />
      </div>
      {first(params.error) ? (
        <p className="rounded-3xl border border-destructive/25 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          {first(params.error)}
        </p>
      ) : null}
      {first(params.message) ? (
        <p className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          {first(params.message)}
        </p>
      ) : null}
      <TransactionsTable
        transactions={workspace.transactions}
        brokerAccounts={workspace.brokerAccounts}
      />
    </div>
  );
}
