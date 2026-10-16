import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * Defense in depth: middleware already gates these routes, but a Server Component auth check
 * here means a misconfigured or bypassed middleware can never render protected content.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
