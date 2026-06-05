import { applySuggestedZonesAction, setZoneModeAction } from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";
import type { PriceZoneView, ZoneMode } from "@/lib/types";

const modes: Array<{ value: ZoneMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "manual", label: "Manual" },
  { value: "suggested", label: "Suggested" },
  { value: "locked", label: "Locked" },
];

export function ZoneModeControl({
  portfolioId,
  symbol,
  zone,
  redirectTo,
  disabled,
}: {
  portfolioId: string;
  symbol: string;
  zone?: PriceZoneView | null;
  redirectTo: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {modes.map((mode) => (
        <form key={mode.value} action={setZoneModeAction}>
          <input type="hidden" name="portfolioId" value={portfolioId} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="zoneMode" value={mode.value} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button
            type="submit"
            size="sm"
            variant={zone?.zoneMode === mode.value ? "default" : "outline"}
            disabled={disabled}
          >
            {mode.label}
          </Button>
        </form>
      ))}
      {zone?.suggestedZones ? (
        <form action={applySuggestedZonesAction}>
          <input type="hidden" name="portfolioId" value={portfolioId} />
          <input type="hidden" name="symbol" value={symbol} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" size="sm" disabled={disabled}>
            Apply suggested
          </Button>
        </form>
      ) : null}
    </div>
  );
}
