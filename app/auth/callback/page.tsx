"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { syncSignedInUser } from "@/lib/auth/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing secure sign in...");

  useEffect(() => {
    let isMounted = true;

    async function completeAuth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          throw error ?? new Error("No active Supabase session was found.");
        }

        await syncSignedInUser(data.session.access_token);

        if (isMounted) {
          router.replace("/events/new");
          router.refresh();
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "Unable to complete sign in.");
        }
      }
    }

    completeAuth();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-br from-white via-[#f8f7ff] to-[#edf4ff] px-6 text-center text-[#09122f]">
      <section className="max-w-md rounded-4xl border border-white/80 bg-white/85 p-8 shadow-2xl shadow-[#3155ff]/12 backdrop-blur">
        <h1 className="text-3xl font-black">Hall Management SaaS</h1>
        <p className="mt-4 text-base font-semibold text-[#52607d]">{message}</p>
        <Link className="mt-8 inline-flex rounded-2xl bg-linear-to-r from-[#3155ff] to-[#7138f5] px-6 py-3 font-black text-white" href="/">
          Back to Home
        </Link>
      </section>
    </main>
  );
}
