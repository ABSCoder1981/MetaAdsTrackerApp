import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background font-sans">
      <main className="flex w-full max-w-2xl flex-col items-center gap-4 px-6 py-32 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-tint text-lg text-accent">
          ◧
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Meta Ads Campaign Performance Tracker</h1>
        <p className="max-w-md text-lg leading-8 text-muted">
          Multi-tenant Meta Ads reporting and Profitability Advisor for real estate marketing teams — see{" "}
          <code className="rounded bg-surface-raised px-1.5 py-0.5 text-sm">docs/ROADMAP.md</code>.
        </p>
        <Link
          href="/login"
          className="rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background"
        >
          Sign in
        </Link>
      </main>
    </div>
  );
}
