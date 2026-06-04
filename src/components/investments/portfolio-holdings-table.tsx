"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CoreSatelliteBar } from "@/components/investments/core-satellite-bar";
import { SignedPercent } from "@/components/investments/signed-value";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { HoldingView } from "@/lib/types";

type SortKey = "symbol" | "actualAllocation" | "drift" | "plPercent";

export function PortfolioHoldingsTable({
  holdings,
  currency,
}: {
  holdings: HoldingView[];
  currency: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("drift");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return holdings
      .filter((holding) => {
        if (!normalizedQuery) {
          return true;
        }

        return (
          holding.symbol.toLowerCase().includes(normalizedQuery) ||
          holding.companyName?.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((a, b) => {
        const modifier = direction === "asc" ? 1 : -1;

        if (sortKey === "symbol") {
          return a.symbol.localeCompare(b.symbol) * modifier;
        }

        return (a[sortKey] - b[sortKey]) * modifier;
      });
  }, [direction, holdings, query, sortKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-white p-3 shadow-[0_14px_45px_rgba(15,35,34,0.06)] sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter symbol or company"
          className="sm:max-w-sm"
        />
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="symbol">Symbol</SelectItem>
            <SelectItem value="actualAllocation">Allocation %</SelectItem>
            <SelectItem value="drift">Drift %</SelectItem>
            <SelectItem value="plPercent">P/L %</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
        >
          <ArrowUpDown className="size-4" aria-hidden="true" />
          {direction.toUpperCase()}
        </Button>
      </div>
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-[0_18px_55px_rgba(15,35,34,0.08)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/35 hover:bg-muted/35">
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
              {rows.map((holding) => (
                <TableRow key={holding.symbol}>
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
                    <SignedPercent value={holding.drift} context="drift" />
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
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
