"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Mode = "password" | "username";

function ForgotForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "username" ? "username" : "password");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "password") {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      await fetch("/api/auth/forgot-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always succeed — don't reveal if email exists
    }

    setLoading(false);
    setSent(true);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setSent(false);
    setError("");
    setEmail("");
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>{mode === "password" ? "Check your email" : "Email sent"}</CardTitle>
          <CardDescription>
            {mode === "password"
              ? `We sent a password reset link to ${email}. Click it to choose a new password.`
              : `If an account exists for ${email}, we've sent the username to that address.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-green-700 hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{mode === "password" ? "Reset your password" : "Find your username"}</CardTitle>
        <CardDescription>
          {mode === "password"
            ? "Enter your email and we'll send you a reset link."
            : "Enter your email and we'll send you your username."}
        </CardDescription>
      </CardHeader>

      {/* Mode toggle */}
      <div className="px-6 pb-2">
        <div className="flex rounded-lg border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => switchMode("password")}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === "password"
                ? "bg-green-700 text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Forgot password
          </button>
          <button
            type="button"
            onClick={() => switchMode("username")}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === "username"
                ? "bg-green-700 text-white"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Forgot username
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={loading}>
            {loading ? "Sending…" : mode === "password" ? "Send reset link" : "Send username"}
          </Button>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ForgotPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense>
        <ForgotForm />
      </Suspense>
    </div>
  );
}
