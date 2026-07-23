import { DashboardAuthGuard } from "@/components/layout/dashboard-auth-guard";

export default function DashboardPage() {
  return <DashboardAuthGuard />;
}
