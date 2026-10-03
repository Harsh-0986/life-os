"use client";

import { useState } from "react";

import { askQuestion } from "@/lib/api";
import type { ChatContext } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  "What is overdue or due today?",
  "Am I double-booked anywhere?",
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
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmed },
    ]);
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
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="font-medium text-neutral-100">Ask about your analysis</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Answers come only from what Gemma extracted. It will say so if the
        information is not enough.
      </p>

      {messages.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              disabled={disabled || pending}
              className="rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-neutral-100 disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <ul className="mt-4 space-y-3">
          {messages.map((message, index) => (
            <li
              key={index}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                message.role === "user"
                  ? "ml-auto bg-neutral-100 text-neutral-900"
                  : "bg-neutral-800/70 text-neutral-200",
              )}
            >
              {message.content}
            </li>
          ))}

          {pending && (
            <li className="flex gap-1.5 px-1" aria-label="Assistant is thinking">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </li>
          )}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-400">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="chat-question" className="sr-only">
          Ask a question
        </label>
        <input
          id="chat-question"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What should I do first?"
          disabled={disabled || pending}
          className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || pending || !input.trim()}
          className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </section>
  );
}