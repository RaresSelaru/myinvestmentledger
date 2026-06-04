"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CoreSatelliteBar } from "@/components/investments/core-satellite-bar";
import { ExplainNumber } from "@/components/investments/explain-number";
import { SignedPercent } from "@/components/investments/signed-value";
import { formatCurrency, formatMoneyPrecise, formatNumber, formatPercent } from "@/lib/format";
import type { HoldingView, Transaction } from "@/lib/types";

export function AllocationTable({
  holdings,
  transactions,
  currency,
}: {
  holdings: HoldingView[];
  transactions: Transaction[];
  currency: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(holdings[0]?.symbol ?? null);

  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_18px_55px_rgba(15,35,34,0.08)]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
              <TableHead className="w-10" />
              <TableHead>Symbol</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Market value</TableHead>
              <TableHead className="text-right">Actual %</TableHead>
              <TableHead className="text-right">Target %</TableHead>
              <TableHead className="text-right">Drift %</TableHead>
              <TableHead className="text-right">P/L %</TableHead>
              <TableHead className="min-w-32">Core/Satellite</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const isOpen = expanded === holding.symbol;
              const recent = transactions
                .filter((transaction) => transaction.symbol === holding.symbol)
                .slice(0, 3);

              return (
                <Fragment key={holding.symbol}>
                  <TableRow key={holding.symbol}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setExpanded(isOpen ? null : holding.symbol)}
                        aria-label={`Toggle ${holding.symbol} details`}
                      >
                        {isOpen ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/portfolio/${holding.symbol}`}>
                        {holding.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {holding.companyName ?? "-"}
                    </TableCell>
                    <TableCell className="text-right metric-tabular">
                      {formatCurrency(holding.marketValue, currency)}
                    </TableCell>
                    <TableCell className="text-right metric-tabular">
                      {formatPercent(holding.actualAllocation)}
                    </TableCell>
                    <TableCell className="text-right metric-tabular">
                      {formatPercent(holding.targetAllocation)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <SignedPercent value={holding.drift} context="drift" />
                        <ExplainNumber
                          formula="Actual portfolio % - Target portfolio %"
                          inputs={[
                            {
                              label: "Actual allocation",
                              value: formatPercent(holding.actualAllocation),
                            },
                            {
                              label: "Target allocation",
                              value: formatPercent(holding.targetAllocation),
                            },
                          ]}
                          updatedAt={holding.updatedAt}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <SignedPercent value={holding.plPercent} />
                    </TableCell>
                    <TableCell>
                      <CoreSatelliteBar
                        core={holding.corePercent}
                        satellite={holding.satellitePercent}
                      />
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow key={`${holding.symbol}-details`}>
                      <TableCell colSpan={9} className="bg-muted/25 p-0">
                        <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_1fr_1fr]">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <Detail label="Quantity" value={formatNumber(holding.quantity, 4)} />
                            <Detail
                              label="Average cost"
                              value={formatMoneyPrecise(holding.averageCost, holding.currency)}
                            />
                            <Detail
                              label="Current price"
                              value={formatMoneyPrecise(holding.currentPrice, holding.currency)}
                            />
                            <Detail
                              label="Cost basis"
                              value={formatCurrency(holding.costBasis, currency)}
                            />
                            <Detail
                              label="Unrealized P/L"
                              value={formatCurrency(holding.unrealizedPl, currency)}
                            />
                            <Detail
                              label="Realized P/L"
                              value={formatCurrency(holding.realizedPl, currency)}
                            />
                          </div>
                          <div className="space-y-3 text-sm">
                            <p className="font-semibold">Targets</p>
                            <Detail
                              label="Target buy"
                              value={
                                holding.targetBuyPrice
                                  ? formatMoneyPrecise(holding.targetBuyPrice, holding.currency)
                                  : "-"
                              }
                            />
                            <Detail
                              label="Target trim"
                              value={
                                holding.targetSellPrice
                                  ? formatMoneyPrecise(holding.targetSellPrice, holding.currency)
                                  : "-"
                              }
                            />
                            <Detail
                              label="Source trace"
                              value={
                                holding.sourceReferences?.length
                                  ? `${holding.sourceReferences.length} import rows`
                                  : recent.length
                                    ? `${recent.length} recent ledger rows`
                                    : "No linked rows"
                              }
                            />
                            {holding.sourceReferences?.slice(0, 2).map((source, index) => (
                              <Detail
                                key={`${source.sourceFingerprint ?? source.rowNumber ?? index}`}
                                label={`Source ${index + 1}`}
                                value={`${source.sheetName ?? "Import"} row ${source.rowNumber ?? "-"}`}
                              />
                            ))}
                          </div>
                          <div className="space-y-3 text-sm">
                            <p className="font-semibold">Latest transactions</p>
                            {recent.length ? (
                              <div className="space-y-2">
                                {recent.map((transaction) => (
                                  <div
                                    key={transaction.id}
                                    className="flex justify-between gap-3 text-muted-foreground"
                                  >
                                    <span>{transaction.date}</span>
                                    <span className="metric-tabular">
                                      {transaction.type} · {formatMoneyPrecise(transaction.amount, transaction.currency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">No transactions yet.</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-2xl bg-white/70 p-3 ring-1 ring-border/60">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="metric-tabular font-medium">{value}</p>
    </div>
  );
}
