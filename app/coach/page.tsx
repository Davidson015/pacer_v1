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
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const askRef = useRef<(question: string) => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    async function loadGreeting() {
      try {
        const response = await fetch("/api/admin/greeting", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { greeting?: unknown };
        const greeting =
          typeof data.greeting === "string" && data.greeting.trim() !== ""
            ? data.greeting
            : OPENING.content;
        if (cancelled) return;
        setMessages((current) => {
          const opening = { role: "assistant" as const, content: greeting };
          return current.length > 0
            ? [opening, ...current.slice(1)]
            : [opening];
        });
      } catch {
        // Keep the default opening when the greeting service is unavailable.
      }
    }

    const initial = window.setTimeout(() => void loadGreeting(), 0);
    const timer = window.setInterval(loadGreeting, 20000);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

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

  useEffect(() => {
    askRef.current = ask;
  });

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    },
    [],
  );

  /** Browser dictation, created on first use so a missing API is a click-time error. */
  function createRecognition(): SpeechRecognition | null {
    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return null;

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-GB";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        const result = event.results[index];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final.trim() !== "") {
        setInput("");
        void askRef.current(final.trim());
      } else {
        setInput(interim);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      setMicError(
        event.error === "not-allowed"
          ? "microphone permission denied"
          : `microphone error: ${event.error}`,
      );
    };
    recognition.onend = () => setListening(false);
    return recognition;
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = recognitionRef.current ?? createRecognition();
    if (!recognition) {
      setMicError("speech recognition is not supported in this browser");
      return;
    }
    recognitionRef.current = recognition;

    stopPlayback();
    setSpeakingIndex(null);
    setMicError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if recognition is already running; keep the UI honest.
      setListening(false);
    }
  }

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
      ...messages.slice(1),
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
    <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-4 bg-black p-4 text-white sm:p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Coach</h1>
        <p className="text-sm text-white/60">the coach built by the run</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === "user"
                ? "flex min-w-0 max-w-full items-center gap-2 self-end"
                : "flex min-w-0 max-w-full items-center gap-2 self-start"
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
                  ? "max-w-[calc(100vw-5rem)] rounded-2xl bg-[#c6ff00] px-4 py-2 break-words whitespace-pre-wrap text-black sm:max-w-[85%]"
                  : "max-w-[calc(100vw-5rem)] rounded-2xl bg-white/5 px-4 py-2 break-words whitespace-pre-wrap text-white sm:max-w-[85%]"
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
          <div className="self-start text-sm text-white/50">
            Coach is checking your splits…
          </div>
        )}
        {error && <div className="text-sm text-red-300">{error}</div>}
      </div>

      {thin && (
        <p className="text-sm text-[#c6ff00]/80">
          Not enough run data for lap analysis yet — the coach will only quote
          what has actually been recorded.
        </p>
      )}

      {!voiceReady && (
        <p className="text-sm text-white/50">
          Voice is off — set ELEVENLABS_API_KEY to hear the coach.
        </p>
      )}
      {voiceError && <p className="text-sm text-red-300">{voiceError}</p>}
      {micError && <p className="text-sm text-red-300">{micError}</p>}
      {listening && (
        <p className="text-sm text-[#c6ff00]">Listening — ask your question.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {STARTER_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => void ask(question)}
            disabled={pending}
            className="min-h-11 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-[#c6ff00] hover:text-[#c6ff00] disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-0 flex gap-2 bg-black py-1"
      >
        <button
          type="button"
          onClick={toggleListening}
          disabled={pending}
          title={listening ? "Stop listening" : "Ask by voice"}
          aria-label={listening ? "Stop listening" : "Ask by voice"}
          aria-pressed={listening}
          className={
            listening
              ? "min-h-11 min-w-11 shrink-0 rounded-full bg-red-600 px-3 py-2 text-white"
              : "min-h-11 min-w-11 shrink-0 rounded-full border border-white/10 px-3 py-2 text-white/70 hover:border-[#c6ff00] hover:text-[#c6ff00] disabled:opacity-40"
          }
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="currentColor"
            className={listening ? "size-4 animate-pulse" : "size-4"}
          >
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
            <path d="M18 11a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="How am I pacing?"
          aria-label="Message the coach"
          className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-white/40 focus:border-[#c6ff00] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || input.trim() === ""}
          className="min-h-11 shrink-0 rounded-full bg-[#c6ff00] px-5 py-2 font-medium text-black hover:brightness-110 disabled:opacity-50"
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
      className="min-h-11 min-w-11 shrink-0 rounded-full border border-white/10 p-2 text-white/70 hover:border-[#c6ff00] hover:text-[#c6ff00] disabled:opacity-40"
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
