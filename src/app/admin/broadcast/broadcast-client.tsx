"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Draft {
  subject: string;
  heading: string;
  subheading: string;
  bodyMarkdown: string;
  ctaLabel: string;
  ctaUrl: string;
  includeReferralBlock: boolean;
}

const field =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500/40";
const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";

export function BroadcastClient({
  initial,
  optedInCount,
  adminEmail,
}: {
  initial: Omit<Draft, "subheading"> & { subheading?: string };
  optedInCount: number;
  adminEmail: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    ...initial,
    subheading: initial.subheading ?? "",
  });
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [testEmail, setTestEmail] = useState(adminEmail);
  const [excludeEmails, setExcludeEmails] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", ...draft }),
      });
      const data = await res.json();
      if (data.html) setPreviewHtml(data.html);
    } finally {
      setPreviewLoading(false);
    }
  }, [draft]);

  // Auto-refresh the preview shortly after edits stop.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(refreshPreview, 500);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [refreshPreview]);

  // Always resolves to a parsed object. On any non-OK / non-JSON response it
  // returns an { error } so the caller can always show a message.
  async function post(mode: "test" | "send", extra?: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...draft, ...extra }),
      });
    } catch {
      return { error: "Couldn't reach the server. The send may not have started — check the Resend log before retrying." };
    }
    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      return {
        error:
          (data && (data.error as string)) ||
          `Server error (${res.status}). Some emails may have gone out — check the Resend log before resending.`,
      };
    }
    return data ?? { error: "The server returned an empty response. Check the Resend log before resending." };
  }

  async function onTest() {
    setStatus({ kind: "info", msg: `Sending test to ${testEmail}…` });
    setTesting(true);
    try {
      const data = await post("test", { testEmail });
      if (data.error) setStatus({ kind: "err", msg: data.error as string });
      else setStatus({ kind: "ok", msg: `✓ Test sent to ${data.recipient ?? testEmail}. Check that inbox.` });
    } catch {
      setStatus({ kind: "err", msg: "Failed to send test." });
    } finally {
      setTesting(false);
    }
  }

  async function onSend() {
    setStatus({
      kind: "info",
      msg: "Sending now… this can take up to a minute. Keep this tab open and don't click send again.",
    });
    setSending(true);
    try {
      const data = await post("send", { excludeEmails });
      if (data.error) {
        setStatus({ kind: "err", msg: data.error as string });
      } else {
        const failed = Number(data.failed ?? 0);
        const parts = [`Sent ${data.sent} of ${data.total}`];
        if (failed) parts.push(`${failed} failed`);
        if (data.skippedBanned) parts.push(`${data.skippedBanned} banned skipped`);
        if (data.excluded) parts.push(`${data.excluded} excluded`);
        setStatus({
          kind: failed ? "err" : "ok",
          msg: `${failed ? "⚠" : "✓"} ${parts.join(" · ")}.`,
        });
        setConfirmText("");
      }
    } catch {
      setStatus({ kind: "err", msg: "Send failed. Some emails may have gone out — check before retrying." });
    } finally {
      setSending(false);
    }
  }

  const canSend = confirmText.trim().toUpperCase() === "SEND" && !sending;

  return (
    <div className="flex h-screen bg-background">
      {/* Composer */}
      <div className="w-[440px] shrink-0 border-r overflow-y-auto p-5 space-y-4">
        <div>
          <h1 className="font-bold text-lg">Broadcast Email</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sends to all <strong>{optedInCount}</strong> opted-in users. Banned and unsubscribed
            users are skipped automatically.
          </p>
        </div>

        <div>
          <label className={labelCls}>Subject line</label>
          <input className={field} value={draft.subject} onChange={(e) => set("subject", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Heading (green banner)</label>
          <input className={field} value={draft.heading} onChange={(e) => set("heading", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Subheading (optional)</label>
          <input className={field} value={draft.subheading} onChange={(e) => set("subheading", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Body</label>
          <textarea
            className={`${field} min-h-[220px] font-mono text-xs leading-relaxed`}
            value={draft.bodyMarkdown}
            onChange={(e) => set("bodyMarkdown", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Formatting: <code>**bold**</code>, <code>[link](https://…)</code>, <code>- bullet</code>,{" "}
            <code>## Heading</code>, <code>### Subheading</code>, blank line = new paragraph.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Button label</label>
            <input className={field} value={draft.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Button link</label>
            <input className={field} value={draft.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.includeReferralBlock}
            onChange={(e) => set("includeReferralBlock", e.target.checked)}
          />
          Include referral bonus-entries block (personalized link per user)
        </label>

        <div className="border-t pt-4 space-y-3">
          <div className="rounded-md border p-3 space-y-2">
            <label className={labelCls}>Send a test to this address first</label>
            <div className="flex gap-2">
              <input
                type="email"
                className={field}
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                onClick={onTest}
                disabled={testing}
                className="shrink-0 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {testing ? "Sending…" : "Send test"}
              </button>
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-2">
            <label className={labelCls}>Skip these addresses (optional)</label>
            <textarea
              className={`${field} min-h-[70px] font-mono text-xs`}
              placeholder="Paste emails to skip — e.g. anyone already sent this. Commas, spaces, or new lines all work."
              value={excludeEmails}
              onChange={(e) => setExcludeEmails(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Anyone listed here is skipped. Useful for re-sends: paste the addresses that already
              got it (from the Resend log) so they don&apos;t receive a duplicate.
            </p>
          </div>

          <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
            <p className="text-xs text-red-800 dark:text-red-300 font-medium">
              To send to all {optedInCount} users, type SEND to confirm:
            </p>
            <input
              className={field}
              placeholder="SEND"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <button
              onClick={onSend}
              disabled={!canSend}
              className="w-full rounded-md bg-red-600 text-white px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? "Sending…" : `Send to all ${optedInCount} opted-in users`}
            </button>
          </div>

          {status && (
            <p
              className={`text-sm font-medium rounded-md px-3 py-3 border ${
                status.kind === "ok"
                  ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300"
                  : status.kind === "info"
                    ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {status.msg}
            </p>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 py-3 flex items-center justify-between">
          <span className="font-medium text-sm">Live preview</span>
          <button onClick={refreshPreview} className="text-xs text-muted-foreground hover:text-foreground">
            {previewLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <iframe
          srcDoc={previewHtml}
          className="flex-1 w-full border-0"
          title="Preview"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
