export function AuthMessage({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) {
    return null;
  }

  return (
    <p
      className={
        error
          ? "rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      }
    >
      {error ?? message}
    </p>
  );
}
