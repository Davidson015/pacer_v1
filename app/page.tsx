import { SignupForm } from "./signup-form";

const SECTIONS = [
  {
    label: "01",
    title: "It listens while you run",
    body: "Every point streams in live — latitude, longitude, pace, lap. No manual logging, no post-run guesswork.",
  },
  {
    label: "02",
    title: "It learns from your real data",
    body: "Distance, average pace, every 400 m split, your fastest and slowest sections. If the data is thin, it says so instead of inventing numbers.",
  },
  {
    label: "03",
    title: "It coaches you with a real voice",
    body: "Ask out loud mid-run and hear the answer in a natural voice, quoting the splits you just ran.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-black text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight">
          Pacer<span className="text-[#c6ff00]">.</span>
        </span>
        <nav className="flex items-center gap-3">
          <a
            href="/build-map"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-[#c6ff00] hover:text-[#c6ff00]"
          >
            Build map
          </a>
          <a
            href="/live"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-[#c6ff00] hover:text-[#c6ff00]"
          >
            Live run
          </a>
          <a
            href="/coach"
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium hover:border-[#c6ff00] hover:text-[#c6ff00]"
          >
            Open the coach
          </a>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 pb-24">
        <section className="flex flex-col gap-8 pt-16 sm:pt-24">
          <p className="text-sm font-semibold tracking-[0.25em] text-[#c6ff00] uppercase">
            the coach built by the run
          </p>
          <h1 className="max-w-4xl text-5xl leading-[0.95] font-black tracking-tight sm:text-7xl lg:text-8xl">
            The first AI coach built by an{" "}
            <span className="text-[#c6ff00]">actual run</span>.
          </h1>
          <p className="max-w-2xl text-lg text-white/60 sm:text-xl">
            Pacer was written lap by lap while its team ran a marathon. It reads
            your run as it happens and coaches you in your ear with the numbers
            you just put down.
          </p>
          <SignupForm />
        </section>

        <section className="grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-3">
          {SECTIONS.map((section) => (
            <div
              key={section.label}
              className="flex flex-col gap-4 bg-black p-8"
            >
              <span className="font-mono text-sm text-[#c6ff00]">
                {section.label}
              </span>
              <h2 className="text-2xl font-bold tracking-tight">
                {section.title}
              </h2>
              <p className="text-white/60">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-start gap-6 rounded-3xl border border-[#c6ff00]/30 bg-[#c6ff00]/5 p-10">
          <h2 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
            Your splits are already talking. Pacer just answers.
          </h2>
          <a
            href="/coach"
            className="rounded-full bg-[#c6ff00] px-6 py-3 font-semibold text-black hover:brightness-110"
          >
            Talk to your coach
          </a>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <p className="mx-auto max-w-6xl text-sm text-white/40">
          Pacer — the coach built by the run.
        </p>
      </footer>
    </div>
  );
}
