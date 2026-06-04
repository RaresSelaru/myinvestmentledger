import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoneyPrecise, formatNumber } from "@/lib/format";
import type { BrokerAccount, Transaction } from "@/lib/types";

export function TransactionsTable({
  transactions,
  brokerAccounts,
}: {
  transactions: Transaction[];
  brokerAccounts: BrokerAccount[];
}) {
  const brokerName = new Map(
    brokerAccounts.map((account) => [account.id, account.name])
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card/90 shadow-lg shadow-black/10">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/35">
              <TableHead>Date</TableHead>
              <TableHead>Broker account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Comment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length ? (
              transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.date}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.brokerAccountId
                      ? brokerName.get(transaction.brokerAccountId) ?? "-"
                      : "-"}
                  </TableCell>
                  <TableCell>{transaction.type.replace("_", " ")}</TableCell>
                  <TableCell className="font-medium">
                    {transaction.symbol ?? "-"}
                  </TableCell>
                  <TableCell className="text-right metric-tabular">
                    {transaction.quantity !== null
                      ? formatNumber(transaction.quantity, 4)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right metric-tabular">
                    {transaction.price !== null
                      ? formatMoneyPrecise(transaction.price, transaction.currency)
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right metric-tabular">
                    {formatMoneyPrecise(transaction.amount, transaction.currency)}
                  </TableCell>
                  <TableCell>{transaction.currency}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge
                        variant={transaction.source === "manual" ? "outline" : "secondary"}
                        className="rounded-md font-normal"
                      >
                        {transaction.source === "manual" ? "Manual" : "XTB import"}
                      </Badge>
                      {transaction.isReconciled ? (
                        <p className="text-[11px] text-muted-foreground">
                          Matched to import
                        </p>
                      ) : transaction.sourceFingerprint ? (
                        <p className="max-w-28 truncate text-[11px] text-muted-foreground">
                          {transaction.sourceFingerprint}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-muted-foreground">
                    {transaction.comment ?? "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No ledger entries yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
