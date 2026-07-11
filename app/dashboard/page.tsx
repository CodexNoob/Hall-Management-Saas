import { DashboardAuthGuard } from "@/components/guards/dashboard-auth-guard";

export default function DashboardPage() {
  return <DashboardAuthGuard />;
}
