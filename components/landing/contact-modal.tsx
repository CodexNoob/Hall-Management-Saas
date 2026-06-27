"use client";

import { FormEvent, MouseEvent, useEffect, useState } from "react";

type ContactForm = {
  name: string;
  email: string;
  company: string;
  message: string;
};

const initialForm: ContactForm = {
  name: "",
  email: "",
  company: "",
  message: ""
};

function BrandMark() {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-end justify-center rounded-2xl bg-linear-to-br from-[#0e4cff] to-[#8b37f6] p-3 shadow-lg shadow-[#3155ff]/20">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M4 28V12L16 4l12 8v16" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M11 28V17h10v11M4 28h24" stroke="white" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="text-2xl font-black tracking-tight text-[#08122f] sm:text-3xl">
        Hall Management <span className="bg-linear-to-r from-[#0e4cff] to-[#8b37f6] bg-clip-text text-transparent">SaaS</span>
      </p>
    </div>
  );
}

function ContactIcon({ type }: { type: "email" | "phone" | "address" }) {
  const paths = {
    email: <path d="M4 7h16v11H4zM4 7l8 6 8-6" />,
    phone: <path d="M7 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L17 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2h2z" />,
    address: <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  };

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0efff] text-[#2447ff]">
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths[type]}
        </g>
      </svg>
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 12 16-8-6 16-3-7zM11 13l9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ContactModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClick = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest("[data-contact-modal]");

      if (trigger) {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const close = () => setIsOpen(false);

  const updateField = (field: keyof ContactForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please complete Name, Email, and Message.");
      setSuccess("");
      return;
    }

    setForm(initialForm);
    setError("");
    setSuccess("Thank you! We'll get back to you soon.");
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center overflow-hidden bg-[rgba(15,23,42,0.55)] p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
    >
      <div
        className="relative max-h-[calc(100vh-48px)] w-[min(1080px,94vw)] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-linear-to-br from-[#cdb8ff] to-[#dff0ff]" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-64 w-96 rounded-[50%] bg-linear-to-tr from-[#dfe6ff] to-transparent" />
        <div className="pointer-events-none absolute right-40 top-12 hidden grid-cols-6 gap-3 opacity-35 md:grid">
          {Array.from({ length: 30 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#3155ff]" />
          ))}
        </div>

        <button
          className="modal-round absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center border border-[#dbe1ee] bg-white text-[#10172f] shadow-md shadow-[#10172f]/10 transition hover:scale-105 hover:bg-[#f8fafc]"
          type="button"
          onClick={close}
          aria-label="Close contact modal"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="contact-modal-content relative z-10 grid max-h-[calc(100vh-48px)] gap-6 overflow-y-auto p-5 sm:p-7 md:grid-cols-2 md:overflow-visible lg:p-8">
          <div>
            <BrandMark />

            <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-[#2447ff]">Contact Us</p>
            <h2 id="contact-modal-title" className="mt-4 max-w-2xl text-3xl font-black leading-[1.08] tracking-tight text-[#08122f] sm:text-4xl">
              Let&apos;s talk about your venue operations
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#53607d]">
              Our team helps you streamline bookings, manage events, simplify payments, and run your hall operations efficiently-so you can focus on what matters most.
            </p>

            <div className="mt-5 max-w-2xl divide-y divide-[#dde4ef]">
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="email" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2447ff]">Email</p>
                  <p className="mt-2 text-base font-semibold text-[#08122f] sm:text-lg">hello@hallmanagementsaas.com</p>
                </div>
              </div>
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="phone" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2447ff]">Phone</p>
                  <p className="mt-2 text-base font-semibold text-[#08122f] sm:text-lg">+1 (555) 123-4567</p>
                </div>
              </div>
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="address" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2447ff]">Address</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-[#08122f] sm:text-lg">
                    123 Venue Street, Suite 100,
                    <br />
                    New York, NY 10001
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form className="rounded-3xl border border-[#dfe5ee] bg-white p-5 shadow-2xl shadow-[#071226]/10" onSubmit={submit}>
            <label className="block text-base font-bold text-[#10172f]" htmlFor="contact-name">
              Name
            </label>
            <input
              id="contact-name"
              className="modal-control mt-3 h-12.5 w-full border border-[#cfd6e4] bg-white px-4 text-base outline-none transition focus:border-[#3155ff] focus:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />

            <label className="mt-4 block text-base font-bold text-[#10172f]" htmlFor="contact-email">
              Email
            </label>
            <input
              id="contact-email"
              className="modal-control mt-3 h-12.5 w-full border border-[#cfd6e4] bg-white px-4 text-base outline-none transition focus:border-[#3155ff] focus:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]"
              placeholder="Enter your email address"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />

            <label className="mt-4 block text-base font-bold text-[#10172f]" htmlFor="contact-company">
              Company
            </label>
            <input
              id="contact-company"
              className="modal-control mt-3 h-12.5 w-full border border-[#cfd6e4] bg-white px-4 text-base outline-none transition focus:border-[#3155ff] focus:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]"
              placeholder="Enter your company name"
              value={form.company}
              onChange={(event) => updateField("company", event.target.value)}
            />

            <label className="mt-4 block text-base font-bold text-[#10172f]" htmlFor="contact-message">
              Message
            </label>
            <textarea
              id="contact-message"
              className="modal-control mt-3 min-h-28 w-full resize-y border border-[#cfd6e4] bg-white px-4 py-4 text-base outline-none transition focus:border-[#3155ff] focus:shadow-[0_0_0_4px_rgba(49,85,255,0.12)]"
              placeholder="Tell us how we can help you..."
              value={form.message}
              onChange={(event) => updateField("message", event.target.value)}
            />

            {error ? <p className="mt-4 text-sm font-semibold text-[#c2410c]">{error}</p> : null}
            {success ? <p className="mt-4 text-sm font-semibold text-[#138a4f]">{success}</p> : null}

            <button
              className="modal-control mt-5 inline-flex h-14 w-full items-center justify-center gap-3 bg-linear-to-r from-[#0e4cff] to-[#8b37f6] text-lg font-black text-white shadow-xl shadow-[#5436ff]/25 transition hover:brightness-110 hover:shadow-2xl"
              type="submit"
            >
              <SendIcon />
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
