import { AsyncState } from "@/components/ui/async-state";

export default function DashboardLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5f6f8] p-4">
      <AsyncState isLoading />
    </main>
  );
}
