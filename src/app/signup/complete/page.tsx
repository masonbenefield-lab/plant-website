"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { containsSlur } from "@/lib/profanity";
import { normalizeUsername, validateUsernameFormat, USERNAME_MIN, USERNAME_MAX } from "@/lib/username";
import { useUsernameAvailability } from "@/lib/use-username-availability";

function CompleteSignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by /auth/callback when an email signup's chosen username didn't stick.
  const retriedUsername = searchParams.get("retry");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const usernameStatus = useUsernameAvailability(username);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.auth.getUser(),
      fetch("/api/geo").then((r) => r.json()).catch(() => ({ country: null })),
    ]).then(([{ data: { user } }, geo]) => {
      if (!user) { router.push("/login"); return; }
      if (geo.country && geo.country !== "US") { setGeoBlocked(true); }
      // Pre-fill the display name they already gave us — Google/Apple send
      // full_name/name, an email signup sends display_name.
      const fullName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.user_metadata?.display_name ??
        "";
      if (fullName) setDisplayName(fullName);
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const formatError = validateUsernameFormat(username);
    if (formatError) {
      setError(formatError);
      return;
    }

    if (containsSlur(username)) {
      setError("Username contains a prohibited word. Please choose a different name.");
      return;
    }

    if (usernameStatus.state === "unavailable") {
      setError(usernameStatus.message);
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName: displayName.trim() || null, emailOptIn }),
    });

    const data = await res.json();
    if (!res.ok) {
      // Server-side US-only backstop — show the same US Only card.
      if (data.geoBlocked) { setGeoBlocked(true); setLoading(false); return; }
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/welcome?confirmed=true");
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (geoBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>US Only (For Now)</CardTitle>
            <CardDescription>
              Plantet is currently available in the United States only. We&apos;re working on expanding — check back soon!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">If you believe this is an error, you may be connected through a VPN or proxy. Try disabling it and reloading.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Finish setting up your account</CardTitle>
          <CardDescription>
            {retriedUsername
              ? `"${retriedUsername}" wasn't available, so pick another username to finish up. Your email is confirmed.`
              : "Just a couple more details and you're in."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-6">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                pattern="[a-z0-9._-]+"
                aria-invalid={usernameStatus.state === "unavailable"}
                placeholder="your-shop-name"
              />
              {usernameStatus.state === "unavailable" ? (
                <p className="text-xs text-destructive">{usernameStatus.message}</p>
              ) : usernameStatus.state === "available" ? (
                <p className="text-xs text-leaf font-medium">{username} is available.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, periods, hyphens, and underscores only. Used in your storefront URL.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Mason's Plant Shop"
              />
              <p className="text-xs text-muted-foreground">What buyers see on your storefront. Can include spaces and capitals.</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <label className="flex items-start gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-leaf"
                required
              />
              <span>
                I confirm I am at least 18 years old, located in the United States, and have read the{" "}
                <Link href="/privacy-policy" className="underline hover:text-foreground" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={emailOptIn}
                onChange={(e) => setEmailOptIn(e.target.checked)}
                className="mt-0.5 accent-leaf"
              />
              <span>
                Send me the weekly plant digest — new arrivals, hot auctions, and picks from shops I follow. Delivered every Sunday. Unsubscribe anytime.
              </span>
            </label>
            <Button type="submit" className="w-full bg-leaf hover:bg-forest" disabled={loading || !ageConfirmed || usernameStatus.state === "unavailable"}>
              {loading ? "Saving…" : "Finish setup"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function CompleteSignupPage() {
  return (
    <Suspense>
      <CompleteSignupContent />
    </Suspense>
  );
}
