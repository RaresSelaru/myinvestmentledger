import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { ExplainInput, ExplainSource } from "@/lib/types";

export function ExplainNumber({
  formula,
  inputs,
  updatedAt,
  sources,
}: {
  formula: string;
  inputs: ExplainInput[];
  updatedAt: string;
  sources?: ExplainSource[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label="Explain number"
        >
          <Info className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Formula
            </p>
            <p className="mt-1 text-sm">{formula}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            {inputs.map((input) => (
              <div
                key={input.label}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="text-muted-foreground">{input.label}</span>
                <span className="metric-tabular font-medium">{input.value}</span>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Updated: {updatedAt}</p>
            {sources?.length ? (
              <div className="space-y-1">
                {sources.map((source) => (
                  <p key={`${source.label}-${source.reference}`}>
                    {source.label}: {source.reference}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
