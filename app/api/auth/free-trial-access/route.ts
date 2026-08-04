import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    const email = typeof payload?.email === "string" ? payload.email : "";

    if (!email.trim()) {
      return NextResponse.json(
        { error: "Please enter your email address." },
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
