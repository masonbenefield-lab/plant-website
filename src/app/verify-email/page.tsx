"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailCheck, RefreshCw } from "lucide-react";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const [emailInput, setEmailInput] = useState(emailParam);
  const email = emailInput.trim();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function resend() {
    if (!email || countdown > 0) return;
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setStatus("error");
    } else {
      setStatus("sent");
      setCountdown(60);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="pb-3">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-sand flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-leaf" />
            </div>
          </div>
          <CardTitle className="text-xl">Check your inbox</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            We sent a confirmation link to{" "}
            {email ? <strong className="text-foreground">{email}</strong> : "your email address"}.
            Click it to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          {!emailParam && (
            <Input
              type="email"
              placeholder="Enter your email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="text-sm"
            />
          )}

          <p className="text-xs text-muted-foreground">
            Don&apos;t see it? Check your spam folder or request a new link below.
          </p>

          {status === "sent" && (
            <p className="text-xs text-leaf font-medium">New link sent — check your inbox.</p>
          )}
          {status === "error" && (
            <p className="text-xs text-destructive">Something went wrong. Try again in a moment.</p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={resend}
            disabled={!email || status === "sending" || countdown > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
            className="gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === "sending" ? "animate-spin" : ""}`} />
            {countdown > 0 ? `Resend in ${countdown}s` : "Resend confirmation email"}
          </Button>

          <div className="border-t pt-3 mt-1">
            <p className="text-xs text-muted-foreground">
              Wrong email?{" "}
              <Link href="/signup" className="underline hover:text-foreground">
                Sign up again
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
