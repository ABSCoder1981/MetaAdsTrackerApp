export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-32 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Meta Ads Campaign Performance Tracker
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Sprint 0 scaffold. Role-based dashboards, campaign monitoring, and
          alerts land starting Sprint 3 — see{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            docs/ROADMAP.md
          </code>
          .
        </p>
      </main>
    </div>
  );
}
