"use client";

import { useState } from "react";

type ChatMessage = {
  role: "visitor" | "assistant";
  text: string;
};

const starterMessages: ChatMessage[] = [
  {
    role: "assistant",
    text: "Hi, I am the Hall Management AI. Ask me about bookings, halls, menus, kitchen sheets, payments, or scheduling."
  }
];

function createReply(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("price") || normalized.includes("pricing")) {
    return "Pricing is customized by venue size and workflow needs. I can help you request a demo so the team can recommend the right plan.";
  }

  if (normalized.includes("demo")) {
    return "A demo is the best next step. Share your venue name, email, and the workflows you want to see: events, kitchen sheets, payments, or calendar sync.";
  }

  if (normalized.includes("calendar")) {
    return "The platform can sync events to Google Calendar and update the same calendar event when booking details change.";
  }

  if (normalized.includes("kitchen") || normalized.includes("menu")) {
    return "Kitchen sheets and menus are connected to each event, so staff can generate clear prep sheets and keep food planning organized.";
  }

  return "I can help explain how Hall Management SaaS handles events, halls, menus, kitchen sheets, payments, files, and calendar workflows.";
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);

  const sendMessage = () => {
    const trimmed = input.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "visitor", text: trimmed },
      { role: "assistant", text: createReply(trimmed) }
    ]);
    setInput("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      {isOpen ? (
        <section className="w-[min(calc(100vw-32px),360px)] border border-[var(--color-line)] bg-white shadow-[8px_8px_0_#d9d6ff]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] bg-black px-4 py-3 text-white">
            <div>
              <p className="text-sm font-black">Hall AI</p>
              <p className="text-xs text-[#d8d8d8]">Online assistant</p>
            </div>
            <button className="text-xl leading-none" type="button" aria-label="Close AI chat" onClick={() => setIsOpen(false)}>
              x
            </button>
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`border p-3 text-sm leading-5 ${
                  message.role === "assistant" ? "mr-8 border-[var(--color-line)] bg-[#f7f7f7]" : "ml-8 border-[#b8923a] bg-[#fff8e8]"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="flex border-t border-[var(--color-line)] p-3">
            <input
              className="h-10 min-w-0 flex-1 border border-[var(--color-line)] px-3 text-sm"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Ask Hall AI..."
              type="text"
            />
            <button className="h-10 border border-black bg-black px-4 text-sm font-bold text-white" type="button" onClick={sendMessage}>
              Send
            </button>
          </div>
        </section>
      ) : (
        <button
          className="ai-chat-trigger flex h-14 w-14 items-center justify-center border border-black bg-black text-white"
          type="button"
          aria-label="Open Hall AI chat"
          onClick={() => setIsOpen(true)}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M8 9h8M8 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="butt" strokeLinejoin="miter" />
          </svg>
        </button>
      )}
    </div>
  );
}
