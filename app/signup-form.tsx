"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    try {
      const response = await fetch("/api/signups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as {
        error?: string;
        alreadySignedUp?: boolean;
      };
      if (!response.ok) throw new Error(data.error ?? "signup failed");

      setStatus("done");
      setMessage(
        data.alreadySignedUp
          ? "You're already on the list. We'll call your splits soon."
          : "You're in. We'll be trackside when you are.",
      );
      setEmail("");
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : "signup failed");
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yourteam.com"
          aria-label="Email address"
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-white placeholder:text-white/40 focus:border-[#c6ff00] focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-full bg-[#c6ff00] px-6 py-3 font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
        >
          {status === "sending" ? "Joining…" : "Get early access"}
        </button>
      </div>
      {message && (
        <p
          role="status"
          className={
            status === "error"
              ? "mt-3 text-sm text-red-400"
              : "mt-3 text-sm text-[#c6ff00]"
          }
        >
          {message}
        </p>
      )}
    </form>
  );
}
