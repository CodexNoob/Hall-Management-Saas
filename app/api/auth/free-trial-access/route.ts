import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { emailField } from "@/features/auth/validations/auth.schema";

export async function POST(request: NextRequest) {
  try {
    const limited = await enforceRateLimit(request, {
      scope: "free-trial-access",
      limit: 10,
      windowMs: 10 * 60 * 1000
    });
    if (limited) return limited;

    const payload = (await request.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    // Same schema the sign-up form uses, so the two cannot disagree about what
    // counts as a usable address.
    const parsed = emailField.safeParse(payload?.email ?? "");

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please enter your email address." },
        { status: 400 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to verify free trial access." },
      { status: 500 }
    );
  }
}
