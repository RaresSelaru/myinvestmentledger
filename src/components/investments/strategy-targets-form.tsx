"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { bulkSaveTargetsAction } from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HoldingView } from "@/lib/types";

type TargetDraft = {
  symbol: string;
  companyName: string | null;
  targetAllocation: string;
  maxAllocation: string;
  targetBuyPrice: string;
  targetSellPrice: string;
  corePercent: number;
  satellitePercent: number;
};

function initialDraft(holding: HoldingView): TargetDraft {
  return {
    symbol: holding.symbol,
    companyName: holding.companyName,
    targetAllocation: String(holding.targetAllocation ?? 0),
    maxAllocation: holding.maxAllocation === null ? "" : String(holding.maxAllocation),
    targetBuyPrice:
      holding.targetBuyPrice === null ? "" : String(holding.targetBuyPrice),
    targetSellPrice:
      holding.targetSellPrice === null ? "" : String(holding.targetSellPrice),
    corePercent: holding.corePercent ?? 100,
    satellitePercent: holding.satellitePercent ?? 0,
  };
}

function optionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function StrategyTargetsForm({
  portfolioId,
  holdings,
  isLocked,
}: {
  portfolioId: string;
  holdings: HoldingView[];
  isLocked: boolean;
}) {
  const [drafts, setDrafts] = useState<TargetDraft[]>(() =>
    holdings.map(initialDraft)
  );
  const totalTarget = useMemo(
    () =>
      drafts.reduce(
        (total, draft) => total + requiredNumber(draft.targetAllocation),
        0
      ),
    [drafts]
  );
  const payload = useMemo(
    () =>
      JSON.stringify(
        drafts.map((draft) => ({
          symbol: draft.symbol,
          targetAllocation: requiredNumber(draft.targetAllocation),
          maxAllocation: optionalNumber(draft.maxAllocation),
          targetBuyPrice: optionalNumber(draft.targetBuyPrice),
          targetSellPrice: optionalNumber(draft.targetSellPrice),
          corePercent: draft.corePercent,
          satellitePercent: draft.satellitePercent,
        }))
      ),
    [drafts]
  );

  function update(index: number, patch: Partial<TargetDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft
      )
    );
  }

  if (!holdings.length) {
    return (
      <p className="rounded-3xl border border-dashed border-primary/25 bg-white px-4 py-12 text-center text-sm text-muted-foreground">
        Import an XTB report first, then tune targets and core/satellite splits here.
      </p>
    );
  }

  return (
    <form action={bulkSaveTargetsAction} className="space-y-4">
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="targetsJson" value={payload} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-muted/35 p-4">
        <div>
          <p className="text-sm font-medium">Allocation plan</p>
          <p className="text-xs text-muted-foreground">
            Total target:{" "}
            <span
              className={cn(
                "metric-tabular font-semibold",
                totalTarget > 100 ? "text-rose-700" : "text-emerald-700"
              )}
            >
              {totalTarget.toFixed(1)}%
            </span>
          </p>
        </div>
        <Button type="submit" disabled={isLocked} size="lg">
          <Save className="size-4" aria-hidden="true" />
          Save strategy
        </Button>
      </div>

      <div className="space-y-3">
        {drafts.map((draft, index) => (
          <div
            key={draft.symbol}
            className="grid gap-4 rounded-3xl border border-border/70 bg-white p-5 shadow-sm md:grid-cols-2 2xl:grid-cols-[140px_repeat(4,minmax(0,1fr))_260px]"
          >
            <div className="min-w-0 md:col-span-2 2xl:col-span-1">
              <p className="font-semibold">{draft.symbol}</p>
              <p className="truncate text-xs text-muted-foreground">
                {draft.companyName ?? "No company profile yet"}
              </p>
            </div>

            <NumberField
              label="Target %"
              value={draft.targetAllocation}
              onChange={(value) => update(index, { targetAllocation: value })}
              disabled={isLocked}
            />
            <NumberField
              label="Max %"
              value={draft.maxAllocation}
              onChange={(value) => update(index, { maxAllocation: value })}
              disabled={isLocked}
            />
            <NumberField
              label="Buy price"
              value={draft.targetBuyPrice}
              onChange={(value) => update(index, { targetBuyPrice: value })}
              disabled={isLocked}
            />
            <NumberField
              label="Trim price"
              value={draft.targetSellPrice}
              onChange={(value) => update(index, { targetSellPrice: value })}
              disabled={isLocked}
            />

            <div className="space-y-3 md:col-span-2 2xl:col-span-1">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs">Core/Satellite</Label>
                <span className="metric-tabular text-xs text-muted-foreground">
                  {draft.corePercent}% / {draft.satellitePercent}%
                </span>
              </div>
              <input
                aria-label={`${draft.symbol} core percentage`}
                type="range"
                min="0"
                max="100"
                step="5"
                value={draft.corePercent}
                onChange={(event) => {
                  const core = Number(event.target.value);
                  update(index, {
                    corePercent: core,
                    satellitePercent: 100 - core,
                  });
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                disabled={isLocked}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.corePercent}
                  onChange={(event) => {
                    const core = Math.max(
                      0,
                      Math.min(100, Number(event.target.value) || 0)
                    );
                    update(index, {
                      corePercent: core,
                      satellitePercent: 100 - core,
                    });
                  }}
                  disabled={isLocked}
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.satellitePercent}
                  onChange={(event) => {
                    const satellite = Math.max(
                      0,
                      Math.min(100, Number(event.target.value) || 0)
                    );
                    update(index, {
                      corePercent: 100 - satellite,
                      satellitePercent: satellite,
                    });
                  }}
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
