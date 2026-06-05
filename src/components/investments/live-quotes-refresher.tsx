"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshLiveQuotesAction } from "@/app/(platform)/actions";

export function LiveQuotesRefresher({
  enabled,
  portfolioId,
  intervalSeconds,
}: {
  enabled: boolean;
  portfolioId: string;
  intervalSeconds: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const lastRunAt = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const intervalMs = Math.max(60, intervalSeconds) * 1000;

    const refresh = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;
      try {
        const result = await refreshLiveQuotesAction(portfolioId);

        if (!cancelled && result.ok) {
          startTransition(() => {
            router.refresh();
          });
        }
      } finally {
        lastRunAt.current = Date.now();
        inFlight = false;
      }
    };

    const firstRun = window.setTimeout(refresh, 1500);
    const interval = window.setInterval(refresh, intervalMs);
    const onVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRunAt.current >= intervalMs
      ) {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearTimeout(firstRun);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalSeconds, portfolioId, router]);

  return null;
}
