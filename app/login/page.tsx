"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState<{ text: string; tone: "warn" | "good" } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const supabase = createClient({ persistSession: mode === "sign-in" ? rememberMe : true });
    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setStatus({ text: error.message, tone: "warn" });
      return;
    }

    if (mode === "sign-up") {
      setStatus({ text: "Account created. If email confirmation is enabled, check your inbox before signing in.", tone: "good" });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      setStatus({ text: "Enter your email above first, then click “Forgot password”.", tone: "warn" });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setStatus(
      error
        ? { text: error.message, tone: "warn" }
        : { text: `Password reset email sent to ${email}.`, tone: "good" }
    );
  }

  return (
    <div className="relative flex flex-1">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Illustration panel — a fixed brand gradient, deliberately independent
          of the Bright/Dark/Playful theme (same treatment as the accent KPI
          card in the dashboard mockups). Hidden below md: the form is what
          matters on a phone screen. */}
      <div className="relative hidden w-2/5 min-w-[320px] overflow-hidden bg-gradient-to-br from-[#1b2461] via-[#3d51c9] to-[#a9b7f5] md:flex md:flex-col md:justify-between">
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#141a4a]" />
        <div className="absolute right-10 top-24 h-16 w-16 rounded-full bg-[#8b9aec]" />
        <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-[#5568d6]" />
        <div className="absolute bottom-20 left-10 h-10 w-10 rounded-full bg-[#c3cdf8]" />

        <div className="relative z-[1] flex flex-1 flex-col justify-end p-10 pb-24">
          <h1 className="mb-2 text-3xl font-bold text-white">
            {mode === "sign-in" ? "Welcome Back!" : "Join the team"}
          </h1>
          <p className="max-w-xs text-sm text-white/80">
            {mode === "sign-in"
              ? "Sign in to see how your campaigns are performing today."
              : "Create an account to start tracking your workspace's campaigns."}
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-tint text-sm text-accent">
              ◧
            </span>
            <span className="text-sm font-bold">Ads Tracker</span>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-accent">
            {mode === "sign-in" ? "Welcome back" : "Get Started"}
          </h2>
          <p className="mb-6 text-sm text-muted">
            {mode === "sign-in" ? "Sign in to your workspace." : "Create an account to get started."}
          </p>

          <label className="mb-1 block text-xs font-medium text-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint"
          />

          <label className="mb-1 block text-xs font-medium text-muted">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-faint"
          />

          {mode === "sign-in" && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border"
                />
                Remember me
              </label>
              <button type="button" onClick={handleForgotPassword} className="text-accent hover:underline">
                Forgot password?
              </button>
            </div>
          )}

          {status && (
            <p
              className={`mt-4 rounded-md px-3 py-2 text-sm ${status.tone === "good" ? "bg-good-tint text-good" : "bg-warn-tint text-warn"}`}
              role="status"
            >
              {status.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
          </button>

          <p className="mt-4 text-center text-sm text-muted">
            {mode === "sign-in" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                setStatus(null);
              }}
              className="font-medium text-accent hover:underline"
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
