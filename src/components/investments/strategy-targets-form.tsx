"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Info, RotateCw, Save } from "lucide-react";
import {
  bulkSaveTargetsAction,
  recalculateSymbolDecisionAction,
} from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DecisionRole, HoldingView } from "@/lib/types";

type TargetDraft = {
  symbol: string;
  companyName: string | null;
  targetAllocation: string;
  maxAllocation: string;
  targetBuyPrice: string;
  targetSellPrice: string;
  corePercent: number;
  satellitePercent: number;
  companyType: string;
  theme: string;
  zoneMode: string;
  manualFairValue: string;
  manualBuyAnchor: string;
  manualTrimAnchor: string;
  thesisIntegrityScore: string;
  catalystQualityScore: string;
  themeStrengthScore: string;
  valueChainCriticalityScore: string;
  macroUncertaintyScore: string;
  qualitativeComment: string;
};

const NONE = "none";

const COMPANY_TYPE_OPTIONS = [
  { value: "profitable_growth", label: "Profitable growth" },
  { value: "high_growth_unprofitable", label: "High-growth unprofitable" },
  { value: "speculative_prerevenue", label: "Speculative pre-revenue" },
  { value: "industrial_infrastructure", label: "Industrial infrastructure" },
  { value: "cyclical_semiconductor", label: "Cyclical semiconductor" },
  { value: "banks_financials", label: "Banks / financials" },
  { value: "commodity_exposed", label: "Commodity exposed" },
];

const ZONE_MODE_OPTIONS = [
  { value: "suggested", label: "Suggested" },
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
  { value: "locked", label: "Locked" },
];

const FIELD_HELP = {
  target:
    "Target allocation is your intended weight for this symbol. Drift is calculated as actual portfolio % minus target %. A positive gap can raise accumulation score; an excess can raise trim pressure.",
  max:
    "Max allocation is a hard ceiling. If the actual allocation reaches or exceeds this value, the max allocation gate blocks further accumulation.",
  buyPrice:
    "Buy price is your simple manual accumulation anchor. It is used as an input for accumulation zones when more advanced valuation data is missing.",
  trimPrice:
    "Trim price is your manual review anchor for reducing exposure. It helps define trim review and strong trim zones.",
  coreSatellite:
    "Core closer to 100 means this holding is intended as a durable portfolio anchor. Satellite closer to 100 means it is more opportunistic; the engine gives it less portfolio-fit weight and more concentration sensitivity.",
  companyType:
    "Company type lets the engine apply sane defaults. For example, speculative pre-revenue companies get lower balance/role confidence until more evidence is available.",
  zoneMode:
    "Auto updates calculated zones automatically. Suggested calculates but waits for you to apply. Manual keeps your anchors as the source of truth. Locked prevents overwrites.",
  theme:
    "Theme is optional context such as AI infrastructure, nuclear, cybersecurity, or cloud. It is used for explainability and later decision grouping.",
  fairValue:
    "Manual fair value is your estimate of reasonable value. If provided, it supports valuation attractiveness and pressure scores.",
  buyAnchor:
    "Manual buy anchor overrides the simple buy price as the preferred lower-zone input. It is never overwritten silently.",
  trimAnchor:
    "Manual trim anchor overrides the simple trim price as the preferred upper-zone input. It is never overwritten silently.",
  thesis:
    "Thesis integrity is your 1-10 score for whether the original reason to own the company is still intact. Scores <= 3 trigger a thesis review gate.",
  catalyst:
    "Catalyst quality is your 1-10 score for visible business or market drivers that could support the thesis. Missing values lower confidence but do not break scoring.",
  themeScore:
    "Theme strength is your 1-10 score for how durable and relevant the investment theme is. It influences thesis quality and confidence.",
  criticality:
    "Value-chain criticality is your 1-10 score for how important the company is in its market or supply chain. Higher values support portfolio fit.",
  macro:
    "Macro uncertainty is your 1-10 score for outside risk. Higher uncertainty lowers conviction in the background explanation.",
  comment:
    "Optional notes are only for your context and traceability. They do not force a decision.",
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
    companyType: holding.companyType ?? NONE,
    theme: holding.theme ?? "",
    zoneMode: holding.zoneMode ?? "suggested",
    manualFairValue:
      holding.manualFairValue === null || holding.manualFairValue === undefined
        ? ""
        : String(holding.manualFairValue),
    manualBuyAnchor:
      holding.manualBuyAnchor === null || holding.manualBuyAnchor === undefined
        ? holding.targetBuyPrice === null
          ? ""
          : String(holding.targetBuyPrice)
        : String(holding.manualBuyAnchor),
    manualTrimAnchor:
      holding.manualTrimAnchor === null || holding.manualTrimAnchor === undefined
        ? holding.targetSellPrice === null
          ? ""
          : String(holding.targetSellPrice)
        : String(holding.manualTrimAnchor),
    thesisIntegrityScore:
      holding.thesisIntegrityScore === null ||
      holding.thesisIntegrityScore === undefined
        ? ""
        : String(holding.thesisIntegrityScore),
    catalystQualityScore:
      holding.catalystQualityScore === null ||
      holding.catalystQualityScore === undefined
        ? ""
        : String(holding.catalystQualityScore),
    themeStrengthScore:
      holding.themeStrengthScore === null ||
      holding.themeStrengthScore === undefined
        ? ""
        : String(holding.themeStrengthScore),
    valueChainCriticalityScore:
      holding.valueChainCriticalityScore === null ||
      holding.valueChainCriticalityScore === undefined
        ? ""
        : String(holding.valueChainCriticalityScore),
    macroUncertaintyScore:
      holding.macroUncertaintyScore === null ||
      holding.macroUncertaintyScore === undefined
        ? ""
        : String(holding.macroUncertaintyScore),
    qualitativeComment: holding.qualitativeComment ?? "",
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

function derivedRole(draft: TargetDraft): DecisionRole {
  if (
    draft.companyType === "speculative_prerevenue" &&
    draft.satellitePercent >= 70
  ) {
    return "speculative";
  }

  return draft.corePercent >= 60 ? "core" : "satellite";
}

function roleSummary(draft: TargetDraft) {
  const role = derivedRole(draft);

  if (role === "speculative") return "Speculative satellite";
  if (role === "core") return "Core-led";
  return "Satellite-led";
}

function targetPayload(draft: TargetDraft) {
  return JSON.stringify([
    {
      symbol: draft.symbol,
      targetAllocation: requiredNumber(draft.targetAllocation),
      maxAllocation: optionalNumber(draft.maxAllocation),
      targetBuyPrice: optionalNumber(draft.targetBuyPrice),
      targetSellPrice: optionalNumber(draft.targetSellPrice),
      corePercent: draft.corePercent,
      satellitePercent: draft.satellitePercent,
      role: derivedRole(draft),
      companyType: draft.companyType === NONE ? null : draft.companyType,
      theme: draft.theme.trim() || null,
      zoneMode: draft.zoneMode,
      manualFairValue: optionalNumber(draft.manualFairValue),
      manualBuyAnchor: optionalNumber(draft.manualBuyAnchor),
      manualTrimAnchor: optionalNumber(draft.manualTrimAnchor),
      thesisIntegrityScore: optionalNumber(draft.thesisIntegrityScore),
      catalystQualityScore: optionalNumber(draft.catalystQualityScore),
      themeStrengthScore: optionalNumber(draft.themeStrengthScore),
      valueChainCriticalityScore: optionalNumber(
        draft.valueChainCriticalityScore
      ),
      macroUncertaintyScore: optionalNumber(draft.macroUncertaintyScore),
      qualitativeComment: draft.qualitativeComment.trim() || null,
    },
  ]);
}

function setupCompleteness(draft: TargetDraft) {
  const fields = [
    requiredNumber(draft.targetAllocation) > 0,
    draft.companyType !== NONE,
    optionalNumber(draft.thesisIntegrityScore) !== null,
    optionalNumber(draft.manualBuyAnchor) !== null ||
      optionalNumber(draft.targetBuyPrice) !== null,
  ];
  const complete = fields.filter(Boolean).length;

  return `${complete}/${fields.length}`;
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
  const [expanded, setExpanded] = useState<string | null>(null);
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

  function update(index: number, patch: Partial<TargetDraft>) {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft
      )
    );
  }

  if (!holdings.length) {
    return (
      <p className="rounded-3xl border border-dashed border-primary/25 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        Import an XTB report first, then tune targets and core/satellite splits here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/70 px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold">Allocation plan</p>
          <p className="text-xs text-muted-foreground">
            Total target:{" "}
            <span
              className={cn(
                "metric-tabular font-semibold",
                totalTarget > 100
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-emerald-700 dark:text-emerald-300"
              )}
            >
              {totalTarget.toFixed(1)}%
            </span>
          </p>
        </div>
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
          Each symbol saves independently. Expand only the positions you want to tune.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        {drafts.map((draft, index) => {
          const isExpanded = expanded === draft.symbol;

          return (
            <form
              key={draft.symbol}
              action={bulkSaveTargetsAction}
              className={cn(
                "border-b border-border/70 last:border-b-0",
                isExpanded ? "bg-muted/20" : "bg-card"
              )}
            >
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <input type="hidden" name="redirectTo" value="/strategy" />
              <input type="hidden" name="symbol" value={draft.symbol} />
              <input type="hidden" name="targetsJson" value={targetPayload(draft)} />

              <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(100px,0.6fr))_auto] lg:items-center">
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 rounded-2xl text-left transition hover:text-primary"
                  onClick={() =>
                    setExpanded((current) =>
                      current === draft.symbol ? null : draft.symbol
                    )
                  }
                  aria-expanded={isExpanded}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                    {draft.symbol.slice(0, 2)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{draft.symbol}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {draft.companyName ?? roleSummary(draft)}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
                      isExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                <CompactValue label="Target" value={`${requiredNumber(draft.targetAllocation).toFixed(1)}%`} />
                <CompactValue
                  label="Max"
                  value={
                    optionalNumber(draft.maxAllocation) === null
                      ? "-"
                      : `${optionalNumber(draft.maxAllocation)?.toFixed(1)}%`
                  }
                />
                <CompactValue
                  label="Split"
                  value={`${draft.corePercent}/${draft.satellitePercent}`}
                />
                <CompactValue
                  label="Setup"
                  value={setupCompleteness(draft)}
                  tone={setupCompleteness(draft) === "4/4" ? "good" : "muted"}
                />

                <SymbolActions isLocked={isLocked} />
              </div>

              {isExpanded ? (
                <div className="space-y-6 border-t border-border/70 px-4 py-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <NumberField
                      label="Target %"
                      help={FIELD_HELP.target}
                      value={draft.targetAllocation}
                      onChange={(value) => update(index, { targetAllocation: value })}
                      disabled={isLocked}
                    />
                    <NumberField
                      label="Max %"
                      help={FIELD_HELP.max}
                      value={draft.maxAllocation}
                      onChange={(value) => update(index, { maxAllocation: value })}
                      disabled={isLocked}
                    />
                    <NumberField
                      label="Buy price"
                      help={FIELD_HELP.buyPrice}
                      value={draft.targetBuyPrice}
                      onChange={(value) => update(index, { targetBuyPrice: value })}
                      disabled={isLocked}
                    />
                    <NumberField
                      label="Trim price"
                      help={FIELD_HELP.trimPrice}
                      value={draft.targetSellPrice}
                      onChange={(value) => update(index, { targetSellPrice: value })}
                      disabled={isLocked}
                    />
                    <CoreSatelliteField
                      draft={draft}
                      disabled={isLocked}
                      onChange={(core, satellite) =>
                        update(index, {
                          corePercent: core,
                          satellitePercent: satellite,
                        })
                      }
                    />
                  </div>

                  <details className="group rounded-3xl border border-border/60 bg-background/55">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                      Decision inputs
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-5 border-t border-border/60 px-4 py-5">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SelectField
                          label="Company type"
                          help={FIELD_HELP.companyType}
                          value={draft.companyType}
                          onChange={(companyType) => update(index, { companyType })}
                          options={[
                            { value: NONE, label: "Not set" },
                            ...COMPANY_TYPE_OPTIONS,
                          ]}
                          disabled={isLocked}
                        />
                        <SelectField
                          label="Zone mode"
                          help={FIELD_HELP.zoneMode}
                          value={draft.zoneMode}
                          onChange={(zoneMode) => update(index, { zoneMode })}
                          options={ZONE_MODE_OPTIONS}
                          disabled={isLocked}
                        />
                        <div className="space-y-2 md:col-span-2">
                          <FieldLabel label="Theme" help={FIELD_HELP.theme} />
                          <Input
                            value={draft.theme}
                            maxLength={120}
                            placeholder="Optional"
                            onChange={(event) =>
                              update(index, { theme: event.target.value })
                            }
                            disabled={isLocked}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <NumberField
                          label="Manual fair value"
                          help={FIELD_HELP.fairValue}
                          value={draft.manualFairValue}
                          onChange={(value) => update(index, { manualFairValue: value })}
                          disabled={isLocked}
                        />
                        <NumberField
                          label="Manual buy anchor"
                          help={FIELD_HELP.buyAnchor}
                          value={draft.manualBuyAnchor}
                          onChange={(value) => update(index, { manualBuyAnchor: value })}
                          disabled={isLocked}
                        />
                        <NumberField
                          label="Manual trim anchor"
                          help={FIELD_HELP.trimAnchor}
                          value={draft.manualTrimAnchor}
                          onChange={(value) => update(index, { manualTrimAnchor: value })}
                          disabled={isLocked}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <ScoreField
                          label="Thesis"
                          help={FIELD_HELP.thesis}
                          value={draft.thesisIntegrityScore}
                          onChange={(value) =>
                            update(index, { thesisIntegrityScore: value })
                          }
                          disabled={isLocked}
                        />
                        <ScoreField
                          label="Catalyst"
                          help={FIELD_HELP.catalyst}
                          value={draft.catalystQualityScore}
                          onChange={(value) =>
                            update(index, { catalystQualityScore: value })
                          }
                          disabled={isLocked}
                        />
                        <ScoreField
                          label="Theme"
                          help={FIELD_HELP.themeScore}
                          value={draft.themeStrengthScore}
                          onChange={(value) =>
                            update(index, { themeStrengthScore: value })
                          }
                          disabled={isLocked}
                        />
                        <ScoreField
                          label="Criticality"
                          help={FIELD_HELP.criticality}
                          value={draft.valueChainCriticalityScore}
                          onChange={(value) =>
                            update(index, { valueChainCriticalityScore: value })
                          }
                          disabled={isLocked}
                        />
                        <ScoreField
                          label="Macro uncertainty"
                          help={FIELD_HELP.macro}
                          value={draft.macroUncertaintyScore}
                          onChange={(value) =>
                            update(index, { macroUncertaintyScore: value })
                          }
                          disabled={isLocked}
                        />
                      </div>

                      <div className="space-y-2">
                        <FieldLabel label="Qualitative comment" help={FIELD_HELP.comment} />
                        <Textarea
                          value={draft.qualitativeComment}
                          maxLength={1000}
                          placeholder="Optional investment context"
                          onChange={(event) =>
                            update(index, { qualitativeComment: event.target.value })
                          }
                          disabled={isLocked}
                          className="min-h-20"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              ) : null}
            </form>
          );
        })}
      </div>
    </div>
  );
}

function CompactValue({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "good";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/35 px-3 py-2 text-sm lg:block lg:bg-transparent lg:p-0">
      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "metric-tabular font-semibold",
          tone === "good" ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SymbolActions({ isLocked }: { isLocked: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="submit" size="sm" disabled={isLocked || pending}>
        <Save className="size-3.5" aria-hidden="true" />
        Save
      </Button>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        formAction={recalculateSymbolDecisionAction}
        disabled={isLocked || pending}
      >
        <RotateCw className="size-3.5" aria-hidden="true" />
        Recalculate
      </Button>
    </div>
  );
}

function SelectField({
  label,
  help,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  help: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} help={help} />
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ScoreField({
  label,
  help,
  value,
  onChange,
  disabled,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <NumberField
      label={label}
      help={help}
      value={value}
      onChange={onChange}
      disabled={disabled}
      min={1}
      max={10}
      step="1"
    />
  );
}

function NumberField({
  label,
  help,
  value,
  onChange,
  disabled,
  min = 0,
  max,
  step = "0.01",
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel label={label} help={help} />
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function CoreSatelliteField({
  draft,
  disabled,
  onChange,
}: {
  draft: TargetDraft;
  disabled?: boolean;
  onChange: (core: number, satellite: number) => void;
}) {
  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-1">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel label="Core/Satellite" help={FIELD_HELP.coreSatellite} />
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
          onChange(core, 100 - core);
        }}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label={`${draft.symbol} core percent`}
          type="number"
          min="0"
          max="100"
          value={draft.corePercent}
          onChange={(event) => {
            const core = Math.max(
              0,
              Math.min(100, Number(event.target.value) || 0)
            );
            onChange(core, 100 - core);
          }}
          disabled={disabled}
        />
        <Input
          aria-label={`${draft.symbol} satellite percent`}
          type="number"
          min="0"
          max="100"
          value={draft.satellitePercent}
          onChange={(event) => {
            const satellite = Math.max(
              0,
              Math.min(100, Number(event.target.value) || 0)
            );
            onChange(100 - satellite, satellite);
          }}
          disabled={disabled}
        />
      </div>
      <p className="text-xs text-muted-foreground">{roleSummary(draft)}</p>
    </div>
  );
}

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            aria-label={`${label} info`}
          >
            <Info className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-w-xs text-xs leading-relaxed">
          {help}
        </PopoverContent>
      </Popover>
    </div>
  );
}
