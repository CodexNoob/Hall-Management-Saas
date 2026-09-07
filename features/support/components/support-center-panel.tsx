"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, Headphones, MessageSquare, Send, X } from "lucide-react";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

type TicketMessage = {
  id: string;
  body: string;
  isStaffReply: boolean;
  createdAt: string;
  author: { name: string } | null;
};

type SupportTicket = {
  id: string;
  reference: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  messages?: TicketMessage[];
};

type TicketsResponse = {
  tickets: SupportTicket[];
  supportEmail: string | null;
};

type TicketMessagesResponse = {
  messages: TicketMessage[];
};

type CreateTicketInput = {
  subject: string;
  description: string;
  category: "BUG" | "ACCOUNT" | "BILLING" | "FEATURE_REQUEST" | "OTHER";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  pageUrl?: string;
  browser?: string;
  device?: string;
  appVersion?: string;
  diagnosticContext?: {
    viewport?: string;
    platform?: string;
    locale?: string;
    timezone?: string;
  };
};

const controlClass = "mt-1 min-h-10 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#1f557d] focus:ring-2 focus:ring-[#1f557d]/15";

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (["RESOLVED", "CLOSED"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (status === "WAITING_FOR_CUSTOMER") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

export function SupportCenterPanel({
  formOpen,
  onFormClose,
  onFormOpen
}: {
  formOpen: boolean;
  onFormClose: () => void;
  onFormOpen: () => void;
}) {
  const query = useAuthenticatedQuery<TicketsResponse>("/api/support/tickets");
  const {
    mutate: createTicket,
    isPending: isCreatingTicket,
    error: createTicketError,
    resetError: resetCreateTicketError
  } = useAuthenticatedMutation<CreateTicketInput, { ticket: SupportTicket }>("/api/support/tickets");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CreateTicketInput["category"]>("BUG");
  const [priority, setPriority] = useState<CreateTicketInput["priority"]>("NORMAL");
  const [createdReference, setCreatedReference] = useState("");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [messageStateByTicketId, setMessageStateByTicketId] = useState<
    Record<
      string,
      {
        messages: TicketMessage[];
        isLoading: boolean;
        error: string;
        loaded: boolean;
      }
    >
  >({});

  const closeForm = useCallback(() => {
    setCreatedReference("");
    setSubject("");
    setDescription("");
    setPriority("NORMAL");
    resetCreateTicketError();
    onFormClose();
  }, [onFormClose, resetCreateTicketError]);

  const openForm = useCallback(() => {
    setCreatedReference("");
    resetCreateTicketError();
    onFormOpen();
  }, [onFormOpen, resetCreateTicketError]);

  const loadMessages = useCallback(
    async (ticketId: string) => {
      const current = messageStateByTicketId[ticketId];
      if (current?.loaded || current?.isLoading) return;

      setMessageStateByTicketId((state) => ({
        ...state,
        [ticketId]: {
          messages: state[ticketId]?.messages ?? [],
          isLoading: true,
          error: "",
          loaded: false
        }
      }));

      try {
        const response = await authenticatedFetch(
          `/api/support/tickets/${ticketId}/messages`
        );
        const payload = (await response.json().catch(() => null)) as
          | (TicketMessagesResponse & { error?: string })
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load replies.");
        }

        setMessageStateByTicketId((state) => ({
          ...state,
          [ticketId]: {
            messages: payload?.messages ?? [],
            isLoading: false,
            error: "",
            loaded: true
          }
        }));
      } catch (error) {
        setMessageStateByTicketId((state) => ({
          ...state,
          [ticketId]: {
            messages: state[ticketId]?.messages ?? [],
            isLoading: false,
            error: error instanceof Error ? error.message : "Unable to load replies.",
            loaded: false
          }
        }));
      }
    },
    [messageStateByTicketId]
  );

  useEffect(() => {
    if (!formOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeForm();
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [closeForm, formOpen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let result: { ticket: SupportTicket };

    try {
      result = await createTicket({
        subject,
        description,
        category,
        priority,
        pageUrl: window.location.href,
        browser: navigator.userAgent,
        device: `${navigator.platform || "Unknown platform"}`,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? "web",
        diagnosticContext: {
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          platform: navigator.platform || undefined,
          locale: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });
    } catch {
      return;
    }

    setCreatedReference(result.ticket.reference);
    setSubject("");
    setDescription("");
    setPriority("NORMAL");
    await query.refetch();
  }

  async function sendReply(ticketId: string) {
    if (reply.trim().length < 2) return;
    setReplyPending(true);
    setReplyError("");
    try {
      const response = await authenticatedFetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: reply.trim() })
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; message?: TicketMessage }
        | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to send reply.");
      setMessageStateByTicketId((state) => ({
        ...state,
        [ticketId]: {
          messages: [...(state[ticketId]?.messages ?? []), payload?.message].filter(
            (message): message is TicketMessage => Boolean(message)
          ),
          isLoading: false,
          error: "",
          loaded: true
        }
      }));
      setReply("");
      await query.refetch();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Unable to send reply.");
    } finally {
      setReplyPending(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
        <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#eef4ff]">
            <Headphones className="h-8 w-8 text-[#1f4d73]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#071427]">Event Core Support</h3>
            <p className="mt-1.5 text-xs leading-5 text-[#617086]">
              Report a bug and receive a trackable reference number.
            </p>
          </div>
        </div>
        <button className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white shadow-lg shadow-[#1f4d73]/18 transition hover:bg-[#15344f]" onClick={openForm} type="button">
          Report a problem <Send className="h-4 w-4" />
        </button>
        {query.data?.supportEmail ? (
          <a className="mt-2 block text-center text-xs font-bold text-[#1f4d73] hover:underline" href={`mailto:${query.data.supportEmail}`}>
            {query.data.supportEmail}
          </a>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#d8dde5] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#1f4d73]" />
          <h3 className="text-sm font-black text-[#071427]">Support requests</h3>
        </div>
        <div className="mt-2 grid gap-2">
          {query.isLoading ? <p className="text-xs text-[#617086]">Loading requests…</p> : null}
          {!query.isLoading && !query.data?.tickets.length ? <p className="text-xs leading-5 text-[#617086]">No support requests have been submitted.</p> : null}
          {query.data?.tickets.slice(0, 8).map((ticket) => {
            const expanded = expandedTicketId === ticket.id;
            const messageState = messageStateByTicketId[ticket.id];
            const messages = messageState?.messages ?? ticket.messages ?? [];
            return (
              <article className="overflow-hidden rounded-lg border border-[#d8dde5]" key={ticket.id}>
                <button
                  className="flex w-full items-center gap-2 p-2.5 text-left"
                  onClick={() => {
                    setExpandedTicketId(expanded ? null : ticket.id);
                    setReply("");
                    setReplyError("");
                    if (!expanded) void loadMessages(ticket.id);
                  }}
                  type="button"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-[#172033]">{ticket.subject}</span>
                    <span className="mt-0.5 block text-[10px] font-bold text-[#64748b]">{ticket.reference}</span>
                  </span>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black ${statusClass(ticket.status)}`}>{readable(ticket.status)}</span>
                  <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded ? (
                  <div className="space-y-3 border-t border-[#d8dde5] bg-[#fbfcfd] p-3">
                    <p className="whitespace-pre-wrap text-xs leading-5 text-[#475569]">{ticket.description}</p>
                    {messageState?.isLoading ? (
                      <p className="text-xs text-[#617086]">Loading replies...</p>
                    ) : null}
                    {messageState?.error ? (
                      <p className="rounded-lg bg-red-50 p-2.5 text-xs font-bold text-red-700">{messageState.error}</p>
                    ) : null}
                    {messages.map((message) => (
                      <div className={`rounded-lg p-2.5 text-xs ${message.isStaffReply ? "bg-[#e8f2fb]" : "bg-white border border-[#d8dde5]"}`} key={message.id}>
                        <p className="font-black">{message.isStaffReply ? "Event Core Support" : message.author?.name ?? "User"}</p>
                        <p className="mt-1 whitespace-pre-wrap leading-5 text-[#475569]">{message.body}</p>
                      </div>
                    ))}
                    {!['RESOLVED', 'CLOSED'].includes(ticket.status) ? (
                      <div>
                        <textarea id={`support-reply-${ticket.id}`} name="supportReply" className={`${controlClass} min-h-20 py-2`} onChange={(event) => setReply(event.target.value)} placeholder="Add more information…" value={reply} />
                        {replyError ? <p className="mt-1 text-xs font-bold text-red-700">{replyError}</p> : null}
                        <button className="mt-2 rounded-lg bg-[#1f4d73] px-3 py-2 text-xs font-black text-white disabled:opacity-50" disabled={replyPending || reply.trim().length < 2} onClick={() => sendReply(ticket.id)} type="button">
                          {replyPending ? "Sending…" : "Send reply"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-10000 flex items-center justify-center bg-[#071427]/70 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
          <section aria-labelledby="support-form-title" aria-modal="true" className="max-h-[calc(100dvh-24px)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" role="dialog">
            <header className="flex items-start gap-3 border-b border-[#d8dde5] p-4 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4e5] text-[#b45309]"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1f4d73]">Event Core Support</p>
                <h2 className="mt-1 text-xl font-black text-[#071427]" id="support-form-title">Report a problem</h2>
                <p className="mt-1 text-xs leading-5 text-[#64748b]">Do not include passwords, card details, or authentication codes.</p>
              </div>
              <button aria-label="Close report form" className="p-2" onClick={closeForm} type="button"><X className="h-5 w-5" /></button>
            </header>
            {createdReference ? (
              <div className="p-6 text-center">
                <h3 className="text-xl font-black text-[#172033]">Request submitted</h3>
                <p className="mt-2 text-sm text-[#64748b]">Your support reference is:</p>
                <p className="mt-3 rounded-xl bg-[#eef4fa] p-4 text-lg font-black text-[#1f557d]">{createdReference}</p>
                <button className="mt-5 rounded-lg bg-[#1f557d] px-5 py-2.5 text-sm font-black text-white" onClick={closeForm} type="button">Done</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                  <label className="text-xs font-black text-[#475569] sm:col-span-2" htmlFor="support-subject">Problem title<input id="support-subject" name="subject" className={controlClass} maxLength={160} minLength={5} onChange={(event) => setSubject(event.target.value)} placeholder="Example: New booking does not save" required value={subject} /></label>
                  <label className="text-xs font-black text-[#475569]" htmlFor="support-category">Category<select id="support-category" name="category" className={controlClass} onChange={(event) => setCategory(event.target.value as CreateTicketInput["category"])} value={category}><option value="BUG">Bug or error</option><option value="ACCOUNT">Account or login</option><option value="BILLING">Billing or subscription</option><option value="FEATURE_REQUEST">Feature request</option><option value="OTHER">Other</option></select></label>
                  <label className="text-xs font-black text-[#475569]" htmlFor="support-priority">Priority<select id="support-priority" name="priority" className={controlClass} onChange={(event) => setPriority(event.target.value as CreateTicketInput["priority"])} value={priority}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="CRITICAL">Critical — service unavailable</option></select></label>
                  <label className="text-xs font-black text-[#475569] sm:col-span-2" htmlFor="support-description">What happened?<textarea id="support-description" name="description" className={`${controlClass} min-h-40 py-3`} maxLength={5000} minLength={20} onChange={(event) => setDescription(event.target.value)} placeholder={'Please include:\n1. What you were trying to do\n2. Steps that caused the problem\n3. What you expected\n4. What happened instead'} required value={description} /></label>
                  {createTicketError ? <p className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700 sm:col-span-2">{createTicketError}</p> : null}
                </div>
                <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] p-4"><button className="rounded-lg border border-[#cbd5e1] bg-white px-4 py-2.5 text-sm font-bold" onClick={closeForm} type="button">Cancel</button><button className="rounded-lg bg-[#1f557d] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={isCreatingTicket} type="submit">{isCreatingTicket ? "Submitting…" : "Submit request"}</button></footer>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
