"use client";

import { useState } from "react";

interface PreviewTarget {
  email: string;
  username: string;
  welcome: boolean;
  entries: string[];
}
interface Preview {
  count: number;
  welcomeCount: number;
  entryCount: number;
  targets: PreviewTarget[];
}
interface SendResult {
  email: string;
  username: string;
  welcome: "sent" | "failed";
  welcomeError?: string;
  entries: Array<{ monthLabel: string; status: "sent" | "failed"; error?: string }>;
}
interface SendResponse {
  welcomeSent: number;
  welcomeFailed: number;
  entriesSent: number;
  entriesFailed: number;
  totalEmails: number;
  results: SendResult[];
}

const card = "rounded-lg border bg-background p-4";

export function ResendAppleClient() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sent, setSent] = useState<SendResponse | null>(null);
  const [loading, setLoading] = useState<"preview" | "send" | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);

  async function loadPreview() {
    setLoading("preview");
    setStatus(null);
    setSent(null);
    try {
      const res = await fetch("/api/admin/resend-apple-bounces", { method: "GET" });
      if (!res.ok) {
        setStatus({ kind: "err", msg: `Preview failed (${res.status}).` });
        return;
      }
      const data: Preview = await res.json();
      setPreview(data);
      if (data.count === 0) {
        setStatus({ kind: "info", msg: "No Apple-relay users need a backfill — nothing to send." });
      }
    } catch {
      setStatus({ kind: "err", msg: "Couldn't reach the server." });
    } finally {
      setLoading(null);
    }
  }

  async function send() {
    if (!preview || preview.count === 0) return;
    const total = preview.welcomeCount + preview.entryCount;
    if (!window.confirm(`Send ${total} email${total === 1 ? "" : "s"} now to ${preview.count} user${preview.count === 1 ? "" : "s"}? This cannot be undone.`)) {
      return;
    }
    setLoading("send");
    setStatus({ kind: "info", msg: "Sending now…" });
    try {
      const res = await fetch("/api/admin/resend-apple-bounces", { method: "POST" });
      if (!res.ok) {
        setStatus({ kind: "err", msg: `Send failed (${res.status}). Check the Resend log before retrying.` });
        return;
      }
      const data: SendResponse = await res.json();
      setSent(data);
      const anyFail = data.welcomeFailed + data.entriesFailed > 0;
      setStatus({
        kind: anyFail ? "err" : "ok",
        msg: anyFail
          ? `Sent ${data.totalEmails}, but ${data.welcomeFailed + data.entriesFailed} failed — see below.`
          : `✓ Sent all ${data.totalEmails} emails. Confirm delivery in Resend.`,
      });
    } catch {
      setStatus({ kind: "err", msg: "Couldn't reach the server. Check the Resend log before retrying." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Re-send Apple Hide-My-Email bounces</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apple&apos;s private email relay bounced every message to{" "}
          <code className="rounded bg-muted px-1">@privaterelay.appleid.com</code> users until the sending
          domain was registered on Aug&nbsp;5. This re-sends the <strong>welcome</strong> and{" "}
          <strong>giveaway-entry</strong> emails those users missed. Only users who finished onboarding and
          signed up before the fix are included. Preview first — it sends nothing.
        </p>
      </div>

      {status && (
        <div
          className={
            "rounded-md border px-4 py-3 text-sm " +
            (status.kind === "ok"
              ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
              : status.kind === "err"
              ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
              : "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400")
          }
        >
          {status.msg}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={loadPreview}
          disabled={loading !== null}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {loading === "preview" ? "Loading…" : "Preview"}
        </button>
        <button
          onClick={send}
          disabled={loading !== null || !preview || preview.count === 0 || sent !== null}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {loading === "send" ? "Sending…" : "Send now"}
        </button>
      </div>

      {preview && preview.count > 0 && !sent && (
        <div className={card}>
          <p className="mb-3 text-sm font-semibold">
            {preview.count} user{preview.count === 1 ? "" : "s"} · {preview.welcomeCount} welcome +{" "}
            {preview.entryCount} giveaway = {preview.welcomeCount + preview.entryCount} emails
          </p>
          <ul className="space-y-2 text-sm">
            {preview.targets.map((t) => (
              <li key={t.email} className="border-b pb-2 last:border-0">
                <span className="font-medium">@{t.username}</span>{" "}
                <span className="text-muted-foreground">{t.email}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">Welcome</span>
                  {t.entries.map((e) => (
                    <span key={e} className="rounded bg-muted px-2 py-0.5 text-xs">
                      Entered · {e}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sent && (
        <div className={card}>
          <p className="mb-3 text-sm font-semibold">Results</p>
          <ul className="space-y-2 text-sm">
            {sent.results.map((r) => (
              <li key={r.email} className="border-b pb-2 last:border-0">
                <span className="font-medium">@{r.username}</span>{" "}
                <span className="text-muted-foreground">{r.email}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs " +
                      (r.welcome === "sent"
                        ? "bg-green-500/15 text-green-700 dark:text-green-400"
                        : "bg-red-500/15 text-red-700 dark:text-red-400")
                    }
                    title={r.welcomeError}
                  >
                    Welcome · {r.welcome}
                  </span>
                  {r.entries.map((e) => (
                    <span
                      key={e.monthLabel}
                      className={
                        "rounded px-2 py-0.5 text-xs " +
                        (e.status === "sent"
                          ? "bg-green-500/15 text-green-700 dark:text-green-400"
                          : "bg-red-500/15 text-red-700 dark:text-red-400")
                      }
                      title={e.error}
                    >
                      {e.monthLabel} · {e.status}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
