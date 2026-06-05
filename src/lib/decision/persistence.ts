import type { DecisionEngineResult, DecisionPriceZones } from "@/lib/decision/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

type Row = Record<string, unknown>;

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function existingZonesFromRow(row: Row | undefined): Partial<DecisionPriceZones> | null {
  if (!row) return null;
  const rawOutputs =
    typeof row.raw_outputs_json === "object" && row.raw_outputs_json !== null
      ? (row.raw_outputs_json as Row)
      : {};

  return {
    strongAccumulation: numberOrNull(row.strong_accumulation),
    lightAccumulation: numberOrNull(row.light_accumulation),
    holdLow: numberOrNull(row.hold_low),
    holdHigh: numberOrNull(row.hold_high),
    trimReview: numberOrNull(row.trim_review),
    strongTrim: numberOrNull(row.strong_trim),
    exitReview: numberOrNull(rawOutputs.exitReview),
    currentZone:
      typeof rawOutputs.currentZone === "string"
        ? (rawOutputs.currentZone as DecisionPriceZones["currentZone"])
        : undefined,
  };
}

function scoresJson(result: DecisionEngineResult) {
  return {
    accumulation_score: result.scores.accumulation,
    hold_score: result.scores.hold,
    trim_score: result.scores.trim,
    liquidation_risk_score: result.scores.liquidationRisk,
    portfolio_fit_score: result.scores.portfolioFit,
  };
}

function gatesJson(result: DecisionEngineResult) {
  return Object.fromEntries(
    result.gates.map((gate) => [
      gate.name,
      {
        active: gate.active,
        label: gate.label,
        effect: gate.effect,
      },
    ])
  );
}

function rawOutputs(result: DecisionEngineResult) {
  return {
    confidence: result.confidence,
    positiveDrivers: result.positiveDrivers,
    negativeDrivers: result.negativeDrivers,
    priceZones: result.priceZones,
    effectivePriceZones: result.effectivePriceZones,
    suggestedPriceZones: result.suggestedPriceZones,
    currentZone: result.effectivePriceZones.currentZone,
    exitReview: result.effectivePriceZones.exitReview,
    interpretation: result.interpretation,
    recentActivitySummary: result.recentActivity,
    recalculationReason: result.recalculationReason,
  };
}

function shouldWriteNumericZones(result: DecisionEngineResult) {
  if (result.effectivePriceZones.zoneMode === "locked") return false;
  if (result.recalculationReason === "apply_suggested") return true;
  if (result.recalculationReason === "manual_recalculate") return true;
  if (result.recalculationReason === "reset_auto") return true;
  return result.effectivePriceZones.zoneMode === "auto";
}

function zoneRow(input: {
  userId: string;
  portfolioId: string;
  result: DecisionEngineResult;
  existing?: Row;
}) {
  const writeNumeric = shouldWriteNumericZones(input.result);
  const existing = existingZonesFromRow(input.existing);
  const zones = writeNumeric ? input.result.effectivePriceZones : existing;
  const rawHolding =
    typeof input.result.rawInputs.holding === "object" &&
    input.result.rawInputs.holding !== null
      ? (input.result.rawInputs.holding as Row)
      : {};

  return {
    user_id: input.userId,
    portfolio_id: input.portfolioId,
    symbol: input.result.symbol,
    zone_mode: input.result.effectivePriceZones.zoneMode,
    strong_accumulation: zones?.strongAccumulation ?? null,
    light_accumulation: zones?.lightAccumulation ?? null,
    hold_low: zones?.holdLow ?? null,
    hold_high: zones?.holdHigh ?? null,
    trim_review: zones?.trimReview ?? null,
    strong_trim: zones?.strongTrim ?? null,
    currency: String(rawHolding.currency ?? "USD"),
    zone_last_recalculated_at: input.result.calculatedAt,
    zone_recalculation_reason: input.result.recalculationReason,
    last_activity_considered_at:
      input.result.recentActivity.lastActivityConsideredAt,
    calculation_version: input.result.calculationVersion,
    raw_inputs_json: input.result.rawInputs,
    raw_outputs_json: rawOutputs(input.result),
  };
}

function activeGateNames(result: DecisionEngineResult) {
  return result.gates
    .filter((gate) => gate.active)
    .map((gate) => gate.name)
    .sort();
}

function meaningfulChange(previous: Row | undefined, result: DecisionEngineResult) {
  if (!previous) return true;
  const previousScores =
    typeof previous.scores_json === "object" && previous.scores_json !== null
      ? (previous.scores_json as Row)
      : {};
  const previousOutputs =
    typeof previous.raw_outputs_json === "object" && previous.raw_outputs_json !== null
      ? (previous.raw_outputs_json as Row)
      : {};
  const previousGates =
    typeof previous.gates_json === "object" && previous.gates_json !== null
      ? (previous.gates_json as Row)
      : {};
  const previousAccumulation = Number(
    (previousScores.accumulation_score as Row | undefined)?.finalScore ?? 0
  );
  const previousTrim = Number(
    (previousScores.trim_score as Row | undefined)?.finalScore ?? 0
  );
  const previousZone = String(previousOutputs.currentZone ?? "");
  const previousConfidence = String(previous.confidence_label ?? "");
  const currentGateNames = activeGateNames(result).join(",");
  const previousGateNames = Object.entries(previousGates)
    .filter(([, value]) => Boolean((value as Row | undefined)?.active))
    .map(([name]) => name)
    .sort()
    .join(",");

  return (
    Math.abs(previousAccumulation - result.scores.accumulation.finalScore) >= 10 ||
    Math.abs(previousTrim - result.scores.trim.finalScore) >= 10 ||
    previousZone !== result.effectivePriceZones.currentZone ||
    previousConfidence !== result.confidence.label ||
    previousGateNames !== currentGateNames ||
    result.recalculationReason === "manual_recalculate" ||
    result.recalculationReason === "apply_suggested" ||
    result.recalculationReason === "lock_zones" ||
    result.recalculationReason === "unlock_zones" ||
    result.recalculationReason === "reset_auto"
  );
}

export async function persistDecisionResults({
  supabase,
  userId,
  portfolioId,
  results,
  previousScoreRows,
  existingZoneRows,
}: {
  supabase: SupabaseClient;
  userId: string;
  portfolioId: string;
  results: DecisionEngineResult[];
  previousScoreRows: Row[];
  existingZoneRows: Row[];
}) {
  const previousBySymbol = new Map(
    previousScoreRows.map((row) => [String(row.symbol ?? "").toUpperCase(), row])
  );
  const zoneBySymbol = new Map(
    existingZoneRows.map((row) => [String(row.symbol ?? "").toUpperCase(), row])
  );
  const scoreRows = results.map((result) => ({
    user_id: userId,
    portfolio_id: portfolioId,
    symbol: result.symbol,
    calculation_version: result.calculationVersion,
    scores_json: scoresJson(result),
    gates_json: gatesJson(result),
    normalized_variables_json: result.variables,
    confidence_score: result.confidence.score,
    confidence_label: result.confidence.label,
    missing_data_json: result.missingData,
    stale_data_json: result.staleData,
    raw_inputs_json: result.rawInputs,
    raw_outputs_json: rawOutputs(result),
    calculated_at: result.calculatedAt,
  }));
  const zoneRows = results.map((result) =>
    zoneRow({
      userId,
      portfolioId,
      result,
      existing: zoneBySymbol.get(result.symbol.toUpperCase()),
    })
  );
  const issueRows = results.flatMap((result) =>
    result.confidence.issues.map((issue) => ({
      user_id: userId,
      portfolio_id: portfolioId,
      symbol: issue.symbol ?? result.symbol,
      scope: issue.scope,
      issue_type: issue.issueType,
      severity: issue.severity,
      message: issue.message,
      source: result.calculationVersion,
    }))
  );
  const now = new Date().toISOString();

  if (scoreRows.length) {
    const { error } = await supabase.from("decision_scores").insert(scoreRows);
    if (error) throw error;
  }

  if (zoneRows.length) {
    const { error } = await supabase
      .from("price_zones")
      .upsert(zoneRows, { onConflict: "user_id,portfolio_id,symbol" });
    if (error) throw error;
  }

  await supabase
    .from("data_quality_issues")
    .update({ resolved_at: now })
    .eq("user_id", userId)
    .eq("portfolio_id", portfolioId)
    .eq("source", results[0]?.calculationVersion ?? "decision-mvp-v1")
    .is("resolved_at", null);

  if (issueRows.length) {
    const { error } = await supabase.from("data_quality_issues").insert(issueRows);
    if (error) throw error;
  }

  const eventRows = results
    .filter((result) => meaningfulChange(previousBySymbol.get(result.symbol), result))
    .map((result) => ({
      user_id: userId,
      portfolio_id: portfolioId,
      symbol: result.symbol,
      event_type: "decision_recalculated",
      reason: result.recalculationReason,
      previous_json: previousBySymbol.get(result.symbol) ?? null,
      next_json: {
        scores: scoresJson(result),
        gates: gatesJson(result),
        currentZone: result.effectivePriceZones.currentZone,
        confidenceLabel: result.confidence.label,
      },
      actor: "system",
    }));

  if (eventRows.length) {
    const { error } = await supabase.from("decision_events").insert(eventRows);
    if (error) throw error;
  }

  return {
    scoreRows: scoreRows.length,
    zoneRows: zoneRows.length,
    issueRows: issueRows.length,
    eventRows: eventRows.length,
  };
}
