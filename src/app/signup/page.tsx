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
  const planInfo = PLAN_LABELS[planParam] ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
        data: { username, plan: planParam },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess(true);
      }
    }

    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
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
          <CardContent className="space-y-4">
            {planInfo && (
              <div className="flex items-center justify-between rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm">
                <span className="font-medium text-green-800 dark:text-green-300">{planInfo.name} plan</span>
                <span className="text-green-700 dark:text-green-400">{planInfo.price}</span>
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
                pattern="[a-z0-9_-]+"
                placeholder="your-shop-name"
              />
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
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 accent-green-700"
                required
              />
              <span>
                I confirm I am at least 18 years old and have read the{" "}
                <Link href="/privacy-policy" className="underline hover:text-foreground" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <Button type="submit" className="w-full bg-green-700 hover:bg-green-800" disabled={loading || !ageConfirmed}>
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
  );
}
