import { RefreshCw } from "lucide-react";
import {
  recalculatePortfolioDecisionAction,
  recalculateSymbolDecisionAction,
} from "@/app/(platform)/actions";
import { Button } from "@/components/ui/button";

export function RecalculateZonesButton({
  portfolioId,
  symbol,
  redirectTo,
  label = "Recalculate zones",
  disabled,
}: {
  portfolioId: string;
  symbol?: string;
  redirectTo: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <form
      action={symbol ? recalculateSymbolDecisionAction : recalculatePortfolioDecisionAction}
    >
      <input type="hidden" name="portfolioId" value={portfolioId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {symbol ? <input type="hidden" name="symbol" value={symbol} /> : null}
      <Button type="submit" variant="outline" size="sm" disabled={disabled}>
        <RefreshCw className="size-4" aria-hidden="true" />
        {label}
      </Button>
    </form>
  );
}
