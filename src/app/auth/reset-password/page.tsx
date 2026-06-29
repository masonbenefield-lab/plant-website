"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

function ResetForm() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    let timerHandle: ReturnType<typeof setTimeout>;

    const markReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timerHandle);
      setReady(true);
    };
    const markInvalid = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timerHandle);
      setInvalid(true);
    };

    // verifyOtp (recovery) and hash-based recovery links both emit
    // PASSWORD_RECOVERY. We never call getSession() here — readiness is only ever
    // triggered by verifying the emailed token, so we can't update the wrong
    // (already-logged-in) account's password.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markReady();
    });

    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

    // Supabase can bounce back with an explicit error (token expired or already
    // used — common when an email scanner pre-opens the link). Fail fast instead
    // of waiting out the timeout.
    if (url.searchParams.get("error") || hashParams.get("error")) {
      markInvalid();
    } else {
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const code = url.searchParams.get("code");

      if (tokenHash && type) {
        // Primary flow: OTP token hash. Verified here with no PKCE code verifier,
        // so the link works on ANY device or email app — not just the browser
        // that requested the reset.
        supabase.auth
          .verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType })
          .then(({ error }) => (error ? markInvalid() : markReady()));
      } else if (code) {
        // Back-compat: older PKCE links (only work in the same browser that
        // requested the reset — kept so already-sent emails still function).
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ error }) => (error ? markInvalid() : markReady()));
      }
      // Otherwise rely on a hash-based PASSWORD_RECOVERY event, or the timeout.
    }

    // Generous timeout for slow connections (Gmail on mobile is especially slow).
    timerHandle = setTimeout(markInvalid, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timerHandle);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  if (invalid) {
    return (
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Link expired or invalid</CardTitle>
          <CardDescription>
            This password reset link has expired or already been used. Request a new one.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <a href="/forgot-password" className="text-sm text-leaf hover:underline">
            Request a new reset link
          </a>
        </CardFooter>
      </Card>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Verifying reset link — this can take a few seconds…</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Must be at least 8 characters.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full bg-leaf hover:bg-forest" disabled={loading}>
            {loading ? "Saving…" : "Set new password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
