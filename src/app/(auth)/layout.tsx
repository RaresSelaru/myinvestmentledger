import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,oklch(0.94_0.03_190),transparent_32rem)] px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
