"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, ChevronDown, ChevronUp, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  initialBio: string | null;
  initialOpenToTrades: boolean;
  disclaimerAccepted: boolean;
}

export default function GardenSettings({ initialBio, initialOpenToTrades, disclaimerAccepted }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(initialBio ?? "");
  const [openToTrades, setOpenToTrades] = useState(initialOpenToTrades);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleTradesToggle() {
    if (!openToTrades && !disclaimerAccepted) {
      setShowDisclaimer(true);
    } else {
      setOpenToTrades((v) => !v);
    }
  }

  function acceptDisclaimer() {
    setDisclaimerChecked(false);
    setShowDisclaimer(false);
    setOpenToTrades(true);
  }

  function save() {
    startTransition(async () => {
      const res = await fetch("/api/garden/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden_bio: bio,
          open_to_trades: openToTrades,
          disclaimer_accepted: openToTrades ? (disclaimerAccepted || disclaimerChecked) : false,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save");
        return;
      }
      toast.success("Garden settings saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
      >
        <Settings size={13} />
        Garden Settings
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border bg-card p-4 space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <Label htmlFor="garden-bio">Garden bio</Label>
            <Textarea
              id="garden-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell visitors about your garden — what you grow, your style, your climate…"
              rows={3}
              maxLength={280}
            />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/280</p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-medium text-sm">
                <ArrowLeftRight size={14} className="text-green-700" />
                Open to trades
              </div>
              <p className="text-xs text-muted-foreground">
                Show a "Open to trades" badge on your community garden card so others can reach out.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTradesToggle}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                openToTrades ? "bg-green-600" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
                  openToTrades ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={isPending} className="bg-green-700 hover:bg-green-800">
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Trades disclaimer modal */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Before you enable trades</DialogTitle>
            <DialogDescription>
              Please read and accept the following before showing your trade availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              Plantet facilitates connections between users but is not a party to any trade agreement.
              All trades are arranged directly between users at their own risk. Plantet is not responsible
              for items lost, damaged, or misrepresented in private trades.
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 accent-green-700 h-4 w-4"
              />
              <span>I understand that trades are arranged privately and Plantet is not responsible for the outcome.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-green-700 hover:bg-green-800"
                disabled={!disclaimerChecked}
                onClick={acceptDisclaimer}
              >
                I Agree
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
