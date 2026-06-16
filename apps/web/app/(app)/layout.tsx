import { ReactNode } from "react";
import { AppShell } from "./_components/app-shell";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
