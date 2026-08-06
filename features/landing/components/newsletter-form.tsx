"use client";

import { FormEvent, useState } from "react";

function MailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 6h16v12H4zM4 6l8 7 8-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24">
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
    </svg>
  );
}

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: "" })
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) throw new Error(result.error ?? "Subscription failed.");

      setEmail("");
      setMessage(result.message ?? "Thank you for subscribing!");
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subscription failed. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form className="mt-8" onSubmit={subscribe}>
      <label className="sr-only" htmlFor="footer-email">Email</label>
      <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
      <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-4 text-[#aeb8d1] focus-within:border-[#8da9c0] focus-within:ring-2 focus-within:ring-[#8da9c0]/25">
        <MailIcon />
        <input
          aria-describedby="newsletter-status"
          autoComplete="email"
          className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#aeb8d1]"
          disabled={status === "submitting"}
          id="footer-email"
          maxLength={254}
          onChange={(event) => { setEmail(event.target.value); setMessage(""); setStatus("idle"); }}
          placeholder="Your email"
          required
          type="email"
          value={email}
        />
      </div>
      <button
        className="group mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#1f4d73] text-base font-black text-white shadow-lg shadow-[#1f4d73]/20 transition hover:bg-[#15344f] disabled:cursor-wait disabled:opacity-70"
        disabled={status === "submitting"}
        type="submit"
      >
        {status === "submitting" ? "Subscribing…" : "Subscribe"}
        {status === "submitting" ? null : <ArrowIcon />}
      </button>
      <p
        aria-live="polite"
        className={`mt-4 min-h-5 text-sm font-semibold ${status === "error" ? "text-[#fca5a5]" : "text-[#93c5b1]"}`}
        id="newsletter-status"
      >
        {message}
      </p>
    </form>
  );
}
