"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [thin, setThin] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIdRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/speak")
      .then((response) => response.json())
      .then((data: { available?: boolean }) => {
        if (!cancelled) setVoiceReady(Boolean(data.available));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /** Stops any current playback and frees its resources. */
  const stopPlayback = useCallback(() => {
    playbackIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => stopPlayback, [stopPlayback]);

  function toggleSpeech(text: string, index: number) {
    if (speakingIndex === index) {
      stopPlayback();
      setSpeakingIndex(null);
      return;
    }
    void speak(text, index);
  }

  /** Ignores events from a clip that a newer request already replaced. */
  function clearIfCurrent(event: React.SyntheticEvent<HTMLAudioElement>) {
    if (event.currentTarget.src === objectUrlRef.current) {
      setSpeakingIndex(null);
    }
  }

  const speak = useCallback(
    async (text: string, index: number) => {
      const audio = audioRef.current;
      if (!audio) return;

      stopPlayback();
      const playbackId = playbackIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setVoiceError(null);
      setSpeakingIndex(index);

      try {
        const response = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "speech failed");
        }
        const blob = await response.blob();
        if (playbackId !== playbackIdRef.current) return;

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        audio.src = url;
        await audio.play();
      } catch (caught) {
        // A newer request replaced this one: it owns the UI state now.
        if (playbackId !== playbackIdRef.current) return;
        setSpeakingIndex(null);
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setVoiceError(
          caught instanceof Error ? caught.message : "speech failed",
        );
      }
    },
    [stopPlayback],
  );

  async function ask(question: string) {
    if (question === "" || pending) return;

    const history: ChatMessage[] = [
      ...messages.filter((message) => message !== OPENING),
      { role: "user", content: question },
    ];
    const shown: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(shown);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = (await response.json()) as {
        reply?: string;
        error?: string;
        dataQuality?: string;
      };
      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "the coach could not reply");
      }
      const reply = data.reply;
      setThin(data.dataQuality !== "rich");
      setMessages([...shown, { role: "assistant", content: reply }]);
      if (voiceReady) void speak(reply, shown.length);
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
                ? "flex items-center gap-2 self-end"
                : "flex items-center gap-2 self-start"
            }
          >
            {message.role === "user" && (
              <SpeakerButton
                onClick={() => toggleSpeech(message.content, index)}
                disabled={!voiceReady}
                active={speakingIndex === index}
              />
            )}
            <div
              className={
                message.role === "user"
                  ? "rounded-2xl bg-blue-600 px-4 py-2 text-white"
                  : "rounded-2xl bg-gray-100 px-4 py-2 dark:bg-gray-800"
              }
            >
              {message.content}
            </div>
            {message.role === "assistant" && (
              <SpeakerButton
                onClick={() => toggleSpeech(message.content, index)}
                disabled={!voiceReady}
                active={speakingIndex === index}
              />
            )}
          </div>
        ))}
        {pending && (
          <div className="self-start text-sm text-gray-500">
            Coach is checking your splits…
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>

      {thin && (
        <p className="text-sm text-amber-700 dark:text-amber-500">
          Not enough run data for lap analysis yet — the coach will only quote
          what has actually been recorded.
        </p>
      )}

      {!voiceReady && (
        <p className="text-sm text-gray-500">
          Voice is off — set ELEVENLABS_API_KEY to hear the coach.
        </p>
      )}
      {voiceError && <p className="text-sm text-red-600">{voiceError}</p>}

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

      <audio
        ref={audioRef}
        onEnded={clearIfCurrent}
        onError={clearIfCurrent}
        className="hidden"
      />
    </main>
  );
}

function SpeakerButton({
  onClick,
  disabled,
  active,
}: {
  onClick: () => void;
  disabled: boolean;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        disabled
          ? "Voice unavailable"
          : active
            ? "Stop playback"
            : "Play this message"
      }
      aria-label={active ? "Stop playing message" : "Play message aloud"}
      className="shrink-0 rounded-full border border-gray-300 p-1.5 text-gray-600 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={active ? "size-4 animate-pulse" : "size-4"}
        fill="currentColor"
      >
        <path d="M4 9v6h3l5 4V5L7 9H4z" />
        {active && (
          <path
            d="M16 8.5a5 5 0 0 1 0 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
