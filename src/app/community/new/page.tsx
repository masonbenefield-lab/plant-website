"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, Loader2, HelpCircle, Camera, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 5;

const POST_TYPES = [
  {
    value: "help" as const,
    label: "Help Request",
    description: "Ask the community for advice or identification",
    icon: <HelpCircle size={18} />,
    color: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300",
    selectedColor: "border-amber-500 bg-amber-100 dark:bg-amber-900/40",
  },
  {
    value: "show_and_tell" as const,
    label: "Show & Tell",
    description: "Share a plant, growth update, or proud moment",
    icon: <Camera size={18} />,
    color: "border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400",
    selectedColor: "border-green-500 bg-green-100 dark:bg-green-900/40",
  },
  {
    value: "discussion" as const,
    label: "Discussion",
    description: "Start a conversation about care, species, or anything plant-related",
    icon: <MessageSquare size={18} />,
    color: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300",
    selectedColor: "border-blue-500 bg-blue-100 dark:bg-blue-900/40",
  },
];

export default function NewCommunityPost() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [postType, setPostType] = useState<"help" | "show_and_tell" | "discussion">("help");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(files: FileList) {
    if (photos.length >= MAX_PHOTOS) { toast.error(`Max ${MAX_PHOTOS} photos`); return; }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} too large (max 8 MB)`); continue; }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `community/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listings").upload(path, file);
      if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in to post"); return; }

      const { data, error } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          post_type: postType,
          title: title.trim(),
          body: body.trim() || null,
          photos,
        })
        .select("id")
        .single();

      if (error) { toast.error("Failed to create post"); return; }
      toast.success("Post created");
      router.push(`/community/${data.id}`);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">New Community Post</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Post type */}
        <div className="space-y-2">
          <Label>Post type</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {POST_TYPES.map((pt) => (
              <button
                key={pt.value}
                type="button"
                onClick={() => setPostType(pt.value)}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border-2 p-3 text-left transition-colors",
                  postType === pt.value ? pt.selectedColor + " " + pt.color : "border-border hover:border-muted-foreground/40"
                )}
              >
                <div className={cn("flex items-center gap-1.5 font-medium text-sm", postType === pt.value ? pt.color.split(" ").filter(c => c.startsWith("text-")).join(" ") : "")}>
                  {pt.icon}
                  {pt.label}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{pt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              postType === "help" ? "What do you need help with?" :
              postType === "show_and_tell" ? "What are you showing off?" :
              "What do you want to discuss?"
            }
            maxLength={200}
            required
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="body">Details {postType !== "help" ? "(optional)" : ""}</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              postType === "help" ? "Describe the issue, what you've tried, care conditions, etc." :
              postType === "show_and_tell" ? "Tell us more about this plant..." :
              "Share your thoughts..."
            }
            rows={5}
            maxLength={2000}
            className="resize-none"
          />
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <Label>Photos ({photos.length}/{MAX_PHOTOS}) — optional</Label>
          <div className="flex flex-wrap gap-3">
            {photos.map((url) => (
              <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
                <Image src={url} alt="Post photo" fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={11} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors text-xs"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {!uploading && <span>Add photo</span>}
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

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending || uploading || !title.trim()} className="bg-green-700 hover:bg-green-800">
            {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Post to Community
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
