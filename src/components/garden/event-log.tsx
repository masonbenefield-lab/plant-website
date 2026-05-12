"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Droplets, Leaf, FlowerIcon, Scissors, Syringe, Apple, StickyNote, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GardenEventType } from "@/lib/supabase/types";

const MAX_EVENT_PHOTOS = 3;

const EVENT_OPTIONS: { value: GardenEventType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watered",     label: "Watered",     icon: <Droplets size={14} />,   color: "bg-blue-100 text-blue-700" },
  { value: "fertilized",  label: "Fertilized",  icon: <Leaf size={14} />,       color: "bg-green-100 text-green-700" },
  { value: "repotted",    label: "Repotted",    icon: <FlowerIcon size={14} />, color: "bg-amber-100 text-amber-700" },
  { value: "pruned",      label: "Pruned",      icon: <Scissors size={14} />,   color: "bg-purple-100 text-purple-700" },
  { value: "treated",     label: "Treated",     icon: <Syringe size={14} />,    color: "bg-red-100 text-red-700" },
  { value: "harvested",   label: "Harvested",   icon: <Apple size={14} />,      color: "bg-orange-100 text-orange-700" },
  { value: "note",        label: "Note",        icon: <StickyNote size={14} />, color: "bg-gray-100 text-gray-700" },
];

const EVENT_MAP = Object.fromEntries(EVENT_OPTIONS.map((e) => [e.value, e]));

interface Event {
  id: string;
  event_type: GardenEventType;
  event_date: string;
  notes: string | null;
  photos: string[];
  created_at: string;
}

interface EventLogProps {
  plantId: string;
  initialEvents: Event[];
}

export function EventLog({ plantId, initialEvents }: EventLogProps) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [eventType, setEventType] = useState<GardenEventType>("watered");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventNotes, setEventNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setEventType("watered");
    setEventDate(new Date().toISOString().slice(0, 10));
    setEventNotes("");
    setPhotos([]);
  }

  async function handlePhotoUpload(files: FileList) {
    if (photos.length >= MAX_EVENT_PHOTOS) {
      toast.error(`Maximum ${MAX_EVENT_PHOTOS} photos per event`);
      return;
    }
    const toUpload = Array.from(files).slice(0, MAX_EVENT_PHOTOS - photos.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 8 MB)`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `events/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("garden").upload(path, file);
      if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("garden_events")
        .insert({
          plant_id: plantId,
          user_id: user.id,
          event_type: eventType,
          event_date: eventDate,
          notes: eventNotes.trim() || null,
          photos,
        })
        .select("id, event_type, event_date, notes, photos, created_at")
        .single();

      if (error) {
        toast.error("Failed to log event");
        return;
      }

      setEvents((prev) => [data as Event, ...prev]);
      toast.success(`${EVENT_MAP[eventType].label} logged`);
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  async function handleDelete(eventId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("garden_events").delete().eq("id", eventId);
    if (error) { toast.error("Failed to delete event"); return; }
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Care log</h2>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger render={<Button size="sm" className="bg-green-700 hover:bg-green-800 gap-1" />}>
            <Plus size={14} />
            Log event
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log a care event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Event type</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {EVENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEventType(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors",
                        eventType === opt.value
                          ? `${opt.color} border-current`
                          : "border-border text-muted-foreground hover:border-green-400"
                      )}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event_date">Date</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event_notes">Notes (optional)</Label>
                <Textarea
                  id="event_notes"
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="e.g. Used liquid fertilizer at half strength, new growth visible"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Photos ({photos.length}/{MAX_EVENT_PHOTOS}) — optional</Label>
                <div className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                      <Image src={url} alt="Event photo" fill className="object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((u) => u !== url))}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={11} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {photos.length < MAX_EVENT_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors text-xs"
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {!uploading && <span>Add</span>}
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.length) handlePhotoUpload(e.target.files); e.target.value = ""; }}
                />
              </div>

              <Button type="submit" disabled={isPending || uploading} className="w-full bg-green-700 hover:bg-green-800">
                {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                Save event
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No events logged yet. Track watering, fertilizing, repotting, and more.
        </p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const meta = EVENT_MAP[event.event_type] ?? EVENT_MAP.note;
            return (
              <div key={event.id} className="flex items-start gap-3 rounded-lg border p-3 group">
                <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.color)}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.event_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {event.notes && (
                    <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{event.notes}</p>
                  )}
                  {event.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {event.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                            <Image src={url} alt={`Event photo ${i + 1}`} fill className="object-cover" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all shrink-0"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
