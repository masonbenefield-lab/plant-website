"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { containsSlur } from "@/lib/profanity";

const PLAN_LABELS: Record<string, { name: string; price: string }> = {
  grower:  { name: "Grower",  price: "$9/mo" },
  nursery: { name: "Nursery", price: "$29/mo" },
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan") ?? "seedling";
  const refParam = searchParams.get("ref") ?? null;
  const planInfo = PLAN_LABELS[planParam] ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [usConfirmed, setUsConfirmed] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoChecked, setGeoChecked] = useState(false);

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((data: { country: string | null }) => {
        if (data.country && data.country !== "US") setGeoBlocked(true);
      })
      .catch(() => {})
      .finally(() => setGeoChecked(true));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (containsSlur(username)) {
      setError("Username contains a prohibited word. Please choose a different name.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { username, display_name: displayName.trim() || null, plan: planParam, email_marketing_opt_in: emailOptIn, referral_code: refParam },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }

    setLoading(false);
  }

  if (geoChecked && geoBlocked) {
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
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — value props */}
      <div className="hidden md:flex flex-col justify-center px-12 py-16 bg-forest text-white w-1/2 shrink-0">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <img src="/plantet-mark-white.svg" alt="" width={32} height={32} />
            <span className="font-bold text-2xl tracking-[-0.02em]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>Plantet</span>
          </div>
          <h2 className="text-3xl font-bold leading-snug mb-3">The marketplace for plant lovers.</h2>
          <p className="text-white/70 text-sm mb-10">Join thousands of growers buying, selling, and connecting over plants.</p>
          <ul className="space-y-6">
            {[
              { icon: "🌱", title: "Track and share your collection", body: "Log every plant you own, make your garden public, and share new additions to your followers' feeds." },
              { icon: "🛒", title: "Buy from independent growers", body: "Discover rare and hard-to-find plants from small nurseries and hobbyists." },
              { icon: "🏷️", title: "Sell at fixed price or auction", body: "List plants, run timed auctions, and get paid directly to your bank." },
              { icon: "🤝", title: "Connect with fellow growers", body: "Ask questions, share plants, and follow growers you love in the community." },
            ].map(({ icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="text-2xl mt-0.5 shrink-0">{icon}</span>
                <div>
                  <p className="font-semibold text-sm">{title}</p>
                  <p className="text-white/65 text-sm mt-0.5">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            {planInfo
              ? `You're signing up for the ${planInfo.name} plan (${planInfo.price})`
              : "Start selling and discovering plants"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pb-6">
            {planInfo && (
              <div className="flex items-center justify-between rounded-lg bg-[#EBF0E6] dark:bg-forest/20 border border-[#C5D4BC] dark:border-forest px-3 py-2 text-sm">
                <span className="font-medium text-forest dark:text-[#A8BF9A]">{planInfo.name} plan</span>
                <span className="text-leaf dark:text-sage">{planInfo.price}</span>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9._-]+"
                placeholder="your-shop-name"
              />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, periods, hyphens, and underscores only. Used in your storefront URL.</p>
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
              <p className="text-xs text-muted-foreground">This is what buyers will see on your storefront. Can include spaces and capitals.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
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
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <label className="flex items-start gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={ageConfirmed && usConfirmed}
                onChange={(e) => { setAgeConfirmed(e.target.checked); setUsConfirmed(e.target.checked); }}
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
            <Button type="submit" className="w-full bg-leaf hover:bg-forest" disabled={loading || !ageConfirmed || !usConfirmed}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
            {planInfo && (
              <p className="text-xs text-center text-muted-foreground">
                You&apos;ll set up billing after confirming your email.
              </p>
            )}
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/login" className="underline">Sign in</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
}
