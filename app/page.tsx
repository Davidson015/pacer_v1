export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">Pacer</h1>
      <p className="text-lg text-gray-600 sm:text-xl dark:text-gray-400">
        the coach built by the run
      </p>
      <a
        href="/coach"
        className="rounded-full bg-blue-600 px-5 py-2 font-medium text-white"
      >
        Talk to your coach
      </a>
    </main>
  );
}
