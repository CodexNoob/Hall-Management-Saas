import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user?.email) {
      return NextResponse.json({ error: "Invalid Supabase session." }, { status: 401 });
    }

    const metadata = data.user.user_metadata;
    const name =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : typeof metadata.name === "string" && metadata.name.trim()
          ? metadata.name.trim()
          : data.user.email.split("@")[0];

    const user = await prisma.user.upsert({
      where: { email: data.user.email },
      update: {
        name,
        googleSub: data.user.app_metadata.provider === "google" ? data.user.id : undefined
      },
      create: {
        email: data.user.email,
        name,
        googleSub: data.user.app_metadata.provider === "google" ? data.user.id : undefined,
        access: {
          create: {
            roleName: "user",
            canManageEvents: true
          }
        }
      },
      include: {
        access: true
      }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleName: user.access?.roleName ?? "user"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync the signed-in user." },
      { status: 500 }
    );
  }
}
