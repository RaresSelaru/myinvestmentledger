import { hasSupabaseEnv } from "@/lib/env";

const staleConfigErrors = new Set([
  "Supabase environment variables are not configured yet.",
  "Authentication is not available yet. Refresh the page and try again.",
]);

export function AuthMessage({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  const visibleError =
    error && staleConfigErrors.has(error) && hasSupabaseEnv()
      ? undefined
      : error;

  if (!visibleError && !message) {
    return null;
  }

  return (
    <p
      className={
        visibleError
          ? "rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200"
      }
    >
      {visibleError ?? message}
    </p>
  );
}
