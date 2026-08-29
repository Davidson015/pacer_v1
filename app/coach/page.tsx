"use client";

import { useState } from "react";
import { STARTER_QUESTIONS } from "@/lib/coach";

type ChatMessage = { role: "user" | "assistant"; content: string };

const OPENING: ChatMessage = {
  role: "assistant",
  content: "I watched every lap. Ask me and I'll give you the splits.",
};

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([OPENING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    if (question === "" || pending) return;

    const history: ChatMessage[] = [
      ...messages.filter((message) => message !== OPENING),
      { role: "user", content: question },
    ];
    setMessages([...messages, { role: "user", content: question }]);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "the coach could not reply");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply as string },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "unexpected error");
    } finally {
      setPending(false);
    }
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    void ask(input.trim());
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Coach</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          the coach built by the run
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "self-end rounded-2xl bg-blue-600 px-4 py-2 text-white"
                : "self-start rounded-2xl bg-gray-100 px-4 py-2 dark:bg-gray-800"
            }
          >
            {message.content}
          </div>
        ))}
        {pending && (
          <div className="self-start text-sm text-gray-500">
            Coach is checking your splits…
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        {STARTER_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void ask(question)}
            disabled={pending}
            className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
          >
            {question}
          </button>
        ))}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="How am I pacing?"
          aria-label="Message the coach"
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          disabled={pending || input.trim() === ""}
          className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
