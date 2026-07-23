"use client";

import Image from "next/image";
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
    <Image
      src="/images/branding/hms-logo-header.png"
      alt="Hall Management SaaS"
      width={612}
      height={408}
      unoptimized
      className="h-auto w-64 max-w-full object-contain"
    />
  );
}

function ContactIcon({ type }: { type: "email" | "phone" | "address" }) {
  const paths = {
    email: <path d="M4 7h16v11H4zM4 7l8 6 8-6" />,
    phone: <path d="M7 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L17 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2h2z" />,
    address: <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  };

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F7F4ED] text-[#1f4d73]">
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {paths[type]}
        </g>
      </svg>
    </div>
  );
}

function FormFieldIcon({ type }: { type: "name" | "email" | "company" | "message" }) {
  const paths = {
    name: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
    email: <path d="M4 6h16v12H4zM4 7l8 6 8-6" />,
    company: <path d="M4 20V7h10v13M14 11h6v9M8 11h2M8 15h2M17 15h1M3 20h18" />,
    message: <path d="M5 5h14v11H9l-4 3v-3H5zM8 9h8M8 12h5" />
  };

  return (
    <svg className="h-5 w-5 text-[#1f4d73]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[type]}
      </g>
    </svg>
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
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-linear-to-br from-[#E5E0D6] to-[#F1F5F9]" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-64 w-96 rounded-[50%] bg-linear-to-tr from-[#E7E3DA] to-transparent" />
        <div className="pointer-events-none absolute right-40 top-12 hidden grid-cols-6 gap-3 opacity-35 md:grid">
          {Array.from({ length: 30 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#1f4d73]" />
          ))}
        </div>

        <button
          className="modal-round absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center border border-[#E5E0D6] bg-white text-[#0F172A] shadow-md shadow-[#0F172A]/10 transition hover:scale-105 hover:bg-[#F7F4ED]"
          type="button"
          onClick={close}
          aria-label="Close contact modal"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="contact-modal-content relative z-10 grid max-h-[calc(100vh-48px)] gap-6 overflow-y-auto overscroll-contain p-5 sm:p-7 md:grid-cols-2 lg:p-8">
          <div>
            <BrandMark />

            <p className="mt-7 text-sm font-black uppercase tracking-[0.3em] text-[#1f4d73]">Contact Us</p>
            <h2 id="contact-modal-title" className="mt-4 max-w-2xl text-3xl font-black leading-[1.08] tracking-tight text-[#0F172A] sm:text-4xl">
              Let&apos;s talk about your venue operations
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#64748B]">
              Our team helps you streamline bookings, manage events, simplify payments, and run your hall operations efficiently-so you can focus on what matters most.
            </p>

            <div className="mt-5 max-w-2xl divide-y divide-[#E5E0D6]">
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="email" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#1f4d73]">Email</p>
                  <p className="mt-2 text-base font-semibold text-[#0F172A] sm:text-lg">hello@hallmanagementsaas.com</p>
                </div>
              </div>
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="phone" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#1f4d73]">Phone</p>
                  <p className="mt-2 text-base font-semibold text-[#0F172A] sm:text-lg">+1 (555) 123-4567</p>
                </div>
              </div>
              <div className="flex gap-4 py-3.5">
                <ContactIcon type="address" />
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#1f4d73]">Address</p>
                  <p className="mt-2 text-base font-semibold leading-7 text-[#0F172A] sm:text-lg">
                    123 Venue Street, Suite 100,
                    <br />
                    New York, NY 10001
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form className="rounded-3xl border border-white/80 bg-white/95 p-5 shadow-2xl shadow-[#1f4d73]/12 backdrop-blur-xl sm:p-8" onSubmit={submit}>
            <p className="text-sm font-black uppercase tracking-[0.24em] text-[#1f4d73]">Get in touch</p>
            <h3 className="mt-3 text-3xl font-black tracking-tight text-[#0F172A]">Send us a message</h3>
            <p className="mt-3 text-base leading-7 text-[#64748B]">Tell us about your venue and how our team can help.</p>

            <label className="mt-7 block text-base font-bold text-[#0F172A]" htmlFor="contact-name">
              Name
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)]">
              <FormFieldIcon type="name" />
              <input
                id="contact-name"
                name="name"
                autoComplete="name"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your full name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="contact-email">
              Email
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)]">
              <FormFieldIcon type="email" />
              <input
                id="contact-email"
                name="email"
                autoComplete="email"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your email address"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="contact-company">
              Company
            </label>
            <div className="login-field mt-3 flex h-14 items-center gap-4 border border-[#E5E0D6] bg-white px-4 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)]">
              <FormFieldIcon type="company" />
              <input
                id="contact-company"
                name="company"
                autoComplete="organization"
                className="min-w-0 flex-1 bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Enter your company name"
                value={form.company}
                onChange={(event) => updateField("company", event.target.value)}
              />
            </div>

            <label className="mt-5 block text-base font-bold text-[#0F172A]" htmlFor="contact-message">
              Message
            </label>
            <div className="login-field mt-3 flex min-h-32 items-start gap-4 border border-[#E5E0D6] bg-white px-4 py-4 transition focus-within:border-[#1f4d73] focus-within:shadow-[0_0_0_4px_rgba(31,77,115,0.14)]">
              <span className="mt-0.5"><FormFieldIcon type="message" /></span>
              <textarea
                id="contact-message"
                name="message"
                className="min-h-24 min-w-0 flex-1 resize-y bg-transparent text-base text-[#0F172A] outline-none placeholder:text-[#9aa5ba]"
                placeholder="Tell us how we can help you..."
                value={form.message}
                onChange={(event) => updateField("message", event.target.value)}
              />
            </div>

            {error ? <p className="mt-4 text-sm font-semibold text-[#c2410c]">{error}</p> : null}
            {success ? <p className="mt-4 text-sm font-semibold text-[#138a4f]">{success}</p> : null}

            <button
              className="login-button mt-7 inline-flex h-16 w-full items-center justify-center gap-3 bg-linear-to-r from-[#1f4d73] to-[#0F172A] text-lg font-black text-white shadow-xl shadow-[#0F172A]/25 transition hover:brightness-110 hover:shadow-2xl"
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
