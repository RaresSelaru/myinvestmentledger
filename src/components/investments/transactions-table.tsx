"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatMoneyPrecise, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrokerAccount, Transaction } from "@/lib/types";

type ActivityFilter = "all" | "trades" | "cash" | "income" | "costs" | "manual";

function activityGroup(transaction: Transaction): ActivityFilter {
  if (transaction.source === "manual") return "manual";
  if (transaction.type === "buy" || transaction.type === "sell") return "trades";
  if (
    transaction.type === "deposit" ||
    transaction.type === "withdrawal" ||
    transaction.type === "internal_transfer"
  ) {
    return "cash";
  }
  if (transaction.type === "dividend" || transaction.type === "interest") return "income";
  if (transaction.type === "fee" || transaction.type === "tax") return "costs";
  return "all";
}

function eventLabel(transaction: Transaction) {
  if (transaction.type === "buy") return "Buy";
  if (transaction.type === "sell") return "Sell";
  if (transaction.type === "deposit") return "Deposit";
  if (transaction.type === "withdrawal") return "Withdrawal";
  if (transaction.type === "dividend") return "Dividend";
  if (transaction.type === "interest") return "Interest";
  if (transaction.type === "fee") return "Fee";
  if (transaction.type === "tax") return "Tax";
  if (transaction.type === "internal_transfer") return "Internal transfer";
  return "Note";
}

function detail(transaction: Transaction) {
  const pieces: string[] = [];

  if (transaction.quantity !== null) {
    pieces.push(`${formatNumber(transaction.quantity, 4)} qty`);
  }

  if (transaction.price !== null) {
    pieces.push(`${formatMoneyPrecise(transaction.price, transaction.currency)} price`);
  }

  if (transaction.realizedPl !== null && transaction.realizedPl !== undefined) {
    pieces.push(`${formatMoneyPrecise(transaction.realizedPl, transaction.currency)} realized P/L`);
  }

  return pieces.join(" · ") || transaction.comment || "-";
}

export function TransactionsTable({
  transactions,
  brokerAccounts,
}: {
  transactions: Transaction[];
  brokerAccounts: BrokerAccount[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const brokerName = useMemo(
    () => new Map(brokerAccounts.map((account) => [account.id, account.name])),
    [brokerAccounts]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (filter !== "all" && activityGroup(transaction) !== filter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        transaction.symbol,
        transaction.comment,
        transaction.type,
        transaction.currency,
        transaction.sourceLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [filter, query, transactions]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/90 p-3 shadow-lg shadow-black/10 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol, comment, or type"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as ActivityFilter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="trades">Trades</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="costs">Fees & taxes</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-lg shadow-black/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/35">
                <TableHead>Date</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length ? (
                filtered.map((transaction) => {
                  const expanded = expandedId === transaction.id;

                  return (
                    <Fragment key={transaction.id}>
                      <TableRow
                        className="cursor-pointer"
                        tabIndex={0}
                        role="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : transaction.id)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setExpandedId(expanded ? null : transaction.id);
                          }
                        }}
                      >
                        <TableCell className="metric-tabular whitespace-nowrap">
                          {formatDateTime(transaction.date)}
                        </TableCell>
                        <TableCell>{eventLabel(transaction)}</TableCell>
                        <TableCell className="font-medium">
                          {transaction.symbol ?? "-"}
                        </TableCell>
                        <TableCell className="max-w-md truncate text-muted-foreground">
                          {detail(transaction)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right metric-tabular",
                            transaction.amount < 0
                              ? "text-rose-300"
                              : transaction.amount > 0
                                ? "text-emerald-300"
                                : ""
                          )}
                        >
                          {formatMoneyPrecise(transaction.amount, transaction.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.source === "manual" ? "outline" : "secondary"
                            }
                            className="rounded-md font-normal"
                          >
                            {transaction.source === "manual" ? "Manual" : "XTB import"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              expanded && "rotate-180"
                            )}
                          />
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow key={`${transaction.id}-details`}>
                          <TableCell colSpan={7} className="bg-background/35">
                            <div className="grid gap-3 text-sm md:grid-cols-3">
                              <TraceItem
                                label="Broker account"
                                value={
                                  transaction.brokerAccountId
                                    ? brokerName.get(transaction.brokerAccountId) ?? "-"
                                    : "-"
                                }
                              />
                              <TraceItem
                                label="Comment"
                                value={transaction.comment ?? "-"}
                              />
                              <TraceItem
                                label="Source fingerprint"
                                value={transaction.sourceFingerprint ?? "Manual entry"}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No activity matches these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function TraceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/70 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words metric-tabular">{value}</p>
    </div>
  );
}
