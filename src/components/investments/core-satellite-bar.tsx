import { cn } from "@/lib/utils";

export function CoreSatelliteBar({
  core,
  satellite,
  className,
}: {
  core: number;
  satellite: number;
  className?: string;
}) {
  const safeCore = Math.max(0, Math.min(100, core));
  const safeSatellite = Math.max(0, Math.min(100, satellite));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="bg-[oklch(0.58_0.12_255)]"
          style={{ width: `${safeCore}%` }}
        />
        <div
          className="bg-[oklch(0.65_0.12_190)]"
          style={{ width: `${safeSatellite}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{safeCore}%</span>
        <span>{safeSatellite}%</span>
      </div>
    </div>
  );
}
