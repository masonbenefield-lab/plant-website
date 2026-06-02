"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ImagePlus, X } from "lucide-react";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { compressImage } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";

const REASONS = [
  "Item not received",
  "Item arrived damaged",
  "Item not as described",
  "Wrong item sent",
  "Other issue",
];

const MAX_PHOTOS = 3;

type DisputeState = {
  id: string;
  status: string;
} | null;

export default function DisputeButton({
  orderId,
  existingDispute,
}: {
  orderId: string;
  existingDispute?: DisputeState;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dispute, setDispute] = useState<DisputeState>(existingDispute ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photoUrls.length;
    if (remaining <= 0) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const newUrls: string[] = [];
    for (const rawFile of files.slice(0, remaining)) {
      const file = await compressImage(rawFile);
      const path = `disputes/${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }
    setPhotoUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
    e.target.value = "";
  }

  async function submitDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    if (details) {
      const hit = findProhibitedWord(details);
      if (hit) {
        toast.error(`Your details contain a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "dispute-details", details);
        return;
      }
    }
    setSubmitting(true);
    const res = await fetch("/api/orders/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, reason, details, images: photoUrls }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("The seller has been notified. They have 5 days to respond.");
      setDispute({ id: data.disputeId, status: "seller_notified" });
      setOpen(false);
      setReason("");
      setDetails("");
      setPhotoUrls([]);
    }
  }

  // Open dispute — show status link to disputes tab
  if (dispute && dispute.status !== "resolved") {
    return (
      <p className="text-xs text-amber-600 flex items-center gap-1">
        <AlertTriangle size={11} />
        Dispute open —{" "}
        <a href="/orders?tab=disputes" className="underline hover:text-amber-700">view in My Disputes</a>
      </p>
    );
  }

  if (dispute?.status === "resolved") {
    return <p className="text-xs text-leaf flex items-center gap-1">✓ Dispute resolved</p>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-red-600 hover:underline transition-colors flex items-center gap-1"
      >
        <AlertTriangle size={11} /> Problem with order
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              We&apos;ll notify the seller first. If they don&apos;t resolve it within 5 days, you can escalate to Plantet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitDispute} className="space-y-4 mt-1">
            <div className="space-y-1">
              <Label>What went wrong? *</Label>
              <Select value={reason} onValueChange={v => { if (v) setReason(v); }}>
                <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispute-details">Additional details <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="dispute-details"
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe what happened…"
                maxLength={500}
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Photos <span className="font-normal text-muted-foreground">(optional, up to 3)</span></Label>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url) => (
                  <div key={url} className="relative w-16 h-16">
                    <Image src={url} alt="Dispute photo" fill className="object-cover rounded-md border" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrls(prev => prev.filter(u => u !== url))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-background border rounded-full flex items-center justify-center hover:bg-red-50"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {photoUrls.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-16 h-16 border-2 border-dashed rounded-md flex flex-col items-center justify-center text-muted-foreground hover:border-leaf hover:text-leaf transition-colors disabled:opacity-50"
                  >
                    <ImagePlus size={18} />
                    <span className="text-[9px] mt-0.5">{uploading ? "…" : "Add"}</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting || uploading || !reason} className="flex-1 bg-red-600 hover:bg-red-700">
                {submitting ? "Submitting…" : "Notify Seller"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
