"use client";

import { useState, type FormEvent } from "react";
import type { CountryCode } from "libphonenumber-js";
import { PhoneField } from "@/components/ui/phone-field";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { DEFAULT_PHONE_COUNTRY, parsePhoneInput } from "@/lib/validation/phone";

export function NewClientDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const mutation = useAuthenticatedMutation<
    Record<string, unknown>,
    { client: { id: string } }
  >("/api/clients");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] =
    useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phoneError, setPhoneError] = useState("");
  const [notes, setNotes] = useState("");
  if (!open) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Same parser the route handler runs. Blank is still fine - a client
    // record does not need a number.
    const parsedPhone = parsePhoneInput(phone, {
      country: phoneCountry,
      label: "Phone number"
    });

    if (parsedPhone.status === "invalid") {
      setPhoneError(parsedPhone.message);
      return;
    }

    setPhoneError("");

    await mutation.mutate({
      name,
      email: email || undefined,
      phone: parsedPhone.status === "valid" ? parsedPhone.value : undefined,
      notes: notes || undefined,
      status: "Active",
      tags: []
    });
    await onCreated();
    setName("");
    setEmail("");
    setPhone("");
    setPhoneError("");
    setNotes("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/35 p-4"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <form
        className="w-full max-w-lg rounded-xl border border-[#d8dde5] bg-white shadow-2xl"
        onSubmit={submit}
      >
        <header className="flex items-center justify-between border-b border-[#d8dde5] p-4">
          <div>
            <h2 className="font-black">New client</h2>
            <p className="mt-1 text-xs text-[#6a7483]">
              Add a client to the organization directory.
            </p>
          </div>
          <button
            aria-label="Close client details"
            className="flex h-9 w-9 items-center justify-center rounded-full text-3xl leading-none hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-xs font-black">
            Client name
            <input
              required
              className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 font-medium"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-xs font-black">
            Email
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 font-medium"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <div className="text-xs font-black">
            <label htmlFor="new-client-phone">Phone</label>
            <PhoneField
              country={phoneCountry}
              id="new-client-phone"
              inputClassName="mt-1 h-10 min-w-0 flex-1 rounded-lg border border-[#b9c2cf] px-3 font-medium"
              onChange={(value) => {
                setPhone(value);
                setPhoneError("");
              }}
              onCountryChange={setPhoneCountry}
              rowClassName="flex gap-2"
              selectClassName="mt-1 h-10 max-w-[8.5rem] rounded-lg border border-[#b9c2cf] px-2 font-medium"
              serverError={phoneError}
              value={phone}
            />
          </div>
          <label className="text-xs font-black sm:col-span-2">
            Notes
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-[#b9c2cf] p-3 font-medium"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {mutation.error ? (
            <p className="text-xs font-bold text-[#a62b24] sm:col-span-2">
              {mutation.error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#d8dde5] p-4">
          <button
            className="h-10 rounded-lg border px-4 text-xs font-black"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-10 rounded-lg bg-[#1f4d73] px-5 text-xs font-black text-white disabled:opacity-60"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? "Saving…" : "Create client"}
          </button>
        </footer>
      </form>
    </div>
  );
}
