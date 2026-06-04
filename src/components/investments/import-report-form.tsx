"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { FileSpreadsheet, Loader2, LockKeyhole, Play, UploadCloud } from "lucide-react";
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
import type { BrokerAccount, Portfolio } from "@/lib/types";

type ImportAction = (formData: FormData) => void | Promise<void>;

type ImportReportFormProps = {
  portfolio: Portfolio;
  brokerAccounts: BrokerAccount[];
  isLocked: boolean;
  stagedImportId?: string | null;
  result?: {
    message?: string | null;
    newRows?: string | null;
    duplicates?: string | null;
    updated?: string | null;
    parsed?: string | null;
    lots?: string | null;
    cash?: string | null;
    transactions?: string | null;
    holdings?: string | null;
  };
  dryRunAction: ImportAction;
  commitAction: ImportAction;
};

export function ImportReportForm({
  portfolio,
  brokerAccounts,
  isLocked,
  stagedImportId,
  result,
  dryRunAction,
  commitAction,
}: ImportReportFormProps) {
  const [intent, setIntent] = useState<"dry" | "import" | null>(null);
  const defaultBrokerAccount = brokerAccounts[0]?.id ?? "";
  const hasStagedImport = Boolean(stagedImportId);

  if (isLocked) {
    return (
      <Card className="max-w-4xl border-primary/20 bg-white">
        <CardContent className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="soft-green-icon size-12">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-heading text-lg font-semibold">Import is available after login</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                This preview uses demo data. Log in to upload private XTB reports,
                run dry runs, and store broker source files securely.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link href="/login">Log in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-5xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="soft-green-icon size-10">
            <FileSpreadsheet className="size-5" aria-hidden="true" />
          </span>
          XTB report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={commitAction} className="space-y-6">
          <input type="hidden" name="portfolioId" value={portfolio.id} />
          {stagedImportId ? (
            <input type="hidden" name="stagedImportId" value={stagedImportId} />
          ) : null}

          <div className="grid gap-5 sm:grid-cols-[minmax(0,300px)_1fr]">
            <div className="space-y-2">
              <Label>Broker account</Label>
              <Select name="brokerAccountId" defaultValue={defaultBrokerAccount}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {brokerAccounts.map((account) => (
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
                required={!hasStagedImport}
              />
            </div>
          </div>

          {hasStagedImport ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5 text-sm">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">Dry run is staged and ready to import.</p>
                  <p className="mt-1 text-muted-foreground">
                    You can import now without selecting the Excel file again.
                  </p>
                  {result?.parsed ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="metric-tabular">
                        {result.parsed} rows · {result.lots ?? "0"} lots · {result.cash ?? "0"} cash rows · {result.transactions ?? "0"} ledger rows
                      </p>
                      {result.holdings ? (
                        <p>Holdings detected: {result.holdings}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {!hasStagedImport && result?.message ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5 text-sm">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium">{result.message}</p>
                  <p className="mt-2 metric-tabular text-xs text-muted-foreground">
                    {result.newRows ?? "0"} new · {result.duplicates ?? "0"} duplicates · {result.updated ?? "0"} corrected
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-1">
            <ImportButton
              action={dryRunAction}
              intent={intent}
              setIntent={setIntent}
              name="dry"
              label="Dry run"
              pendingLabel="Checking"
              variant="outline"
            >
              <Play className="size-4" aria-hidden="true" />
            </ImportButton>
            <ImportButton
              action={commitAction}
              intent={intent}
              setIntent={setIntent}
              name="import"
              label={hasStagedImport ? "Import staged report" : "Import report"}
              pendingLabel="Importing"
            >
              <UploadCloud className="size-4" aria-hidden="true" />
            </ImportButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ImportButton({
  action,
  intent,
  setIntent,
  name,
  label,
  pendingLabel,
  variant = "default",
  children,
}: {
  action: ImportAction;
  intent: "dry" | "import" | null;
  setIntent: (intent: "dry" | "import") => void;
  name: "dry" | "import";
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline";
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  const isActive = pending && intent === name;

  return (
    <Button
      type="submit"
      size="lg"
      variant={variant}
      formAction={action}
      disabled={pending}
      onClick={() => setIntent(name)}
    >
      {isActive ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        children
      )}
      {isActive ? pendingLabel : label}
    </Button>
  );
}
