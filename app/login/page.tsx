"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    if (mode === "sign-up") {
      setStatus("Account created. If email confirmation is enabled, check your inbox before signing in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex flex-1 items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-8"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-tint text-sm text-accent">
            ◧
          </span>
          <span className="text-sm font-bold">Ads Tracker</span>
        </div>
        <h1 className="mb-1 text-xl font-bold">Meta Ads Campaign Performance Tracker</h1>
        <p className="mb-6 text-sm text-muted">
          {mode === "sign-in" ? "Sign in to your workspace." : "Create an account to get started."}
        </p>

        <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />

        <label className="mb-1 block text-sm font-medium text-foreground">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />

        {status && (
          <p className="mb-4 rounded-md bg-warn-tint px-3 py-2 text-sm text-warn" role="status">
            {status}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mb-3 w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
          className="w-full text-center text-sm text-muted hover:text-accent"
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
