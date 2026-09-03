import { NextResponse } from "next/server";
import { withRoute } from "@/lib/http/with-route";

export const GET = withRoute(
  "GET /api/health",
  async () => {
    return NextResponse.json({
      ok: true,
      service: "hall-management-saas-platform"
    });
  }
);
