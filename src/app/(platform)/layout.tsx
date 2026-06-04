import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getWorkspaceData } from "@/lib/data";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const workspace = await getWorkspaceData();

  return <AppShell workspace={workspace}>{children}</AppShell>;
}
