"use client";

import { useState } from "react";

import { askQuestion } from "@/lib/api";
import type { ChatContext } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  context: ChatContext;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "What should I do first?",
  "What is due in the next 24 hours?",
  "Where am I double-booked?",
];

export function ChatPanel({ context, disabled }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    setError(null);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setPending(true);

    try {
      const { answer } = await askQuestion(trimmed, context);
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The assistant could not answer that.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-t-2 border-ink pt-8">
      <h2 className="sleeve-label mb-1 text-ink-3">Ask about this sheet</h2>
      <p className="mb-5 text-sm text-ink-2">
        Answers come only from what was extracted. If the sheet does not say, the
        assistant will tell you rather than guess.
      </p>

      {messages.length === 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              disabled={disabled || pending}
              className="border border-rule px-3 py-1.5 text-sm text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <ul className="mb-5 max-w-2xl space-y-4">
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-md border border-ink bg-ink px-4 py-2.5 text-paper"
                  : "max-w-2xl border-l-2 border-rule-strong pl-4 text-ink"
              }
            >
              <span className="sleeve-label mb-1 block text-ink-3">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              <span className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </span>
            </li>
          ))}

          {pending && (
            <li className="flex items-center gap-1.5 pl-4" aria-label="Thinking">
              {[0, 160, 320].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </li>
          )}
        </ul>
      )}

      {error && (
        <p role="alert" className="mb-5 text-sm font-medium text-grease">
          {error}
        </p>
      )}

      <form
        className="flex max-w-2xl gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="chat-question" className="sr-only">
          Ask a question about your analysis
        </label>
        <input
          id="chat-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What should I do first?"
          disabled={disabled || pending}
          className="min-w-0 flex-1 border border-rule bg-paper-raised px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="sleeve-label border-2 border-ink px-5 py-2.5 text-ink transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </section>
  );
}