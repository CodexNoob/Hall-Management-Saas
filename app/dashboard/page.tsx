import { DashboardAuthGuard } from "@/components/dashboard/dashboard-auth-guard";

export default function DashboardPage() {
  return <DashboardAuthGuard />;
}