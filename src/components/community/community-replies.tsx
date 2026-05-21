"use client";

import { useState, useRef, useTransition } from "react";
import { compressImage } from "@/lib/compress-image";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Reply = {
  id: string;
  user_id: string;
  body: string;
  photos: string[];
  is_solution: boolean;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

interface Props {
  postId: string;
  postType: "help" | "show_and_tell" | "discussion";
  postOwnerId: string;
  currentUserId: string | null;
  solved: boolean;
  initialReplies: Reply[];
}

const MAX_PHOTOS = 3;

export function CommunityReplies({ postId, postType, postOwnerId, currentUserId, solved: initialSolved, initialReplies }: Props) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [solved, setSolved] = useState(initialSolved);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(files: FileList) {
    if (photos.length >= MAX_PHOTOS) { toast.error("Max 3 photos per reply"); return; }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      const file = await compressImage(rawFile);
      const path = `community/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from("listings").upload(path, file);
      if (error) { toast.error(`Failed to upload`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in to reply"); return; }

      const { data, error } = await supabase
        .from("community_replies")
        .insert({ post_id: postId, user_id: user.id, body: body.trim(), photos })
        .select("id, user_id, body, photos, is_solution, created_at")
        .single();
      if (error) { toast.error("Failed to post reply"); return; }

      const { data: profile } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single();
      setReplies((prev) => [...prev, {
        ...data,
        photos: data.photos as string[],
        username: profile?.username ?? "unknown",
        avatar_url: profile?.avatar_url ?? null,
      }]);
      setBody("");
      setPhotos([]);
    });
  }

  async function handleDelete(replyId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("community_replies").delete().eq("id", replyId);
    if (error) { toast.error("Failed to delete"); return; }
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
  }

  async function markSolution(replyId: string) {
    const supabase = createClient();
    // Unmark any existing solution
    const existing = replies.find((r) => r.is_solution);
    if (existing) {
      await supabase.from("community_replies").update({ is_solution: false }).eq("id", existing.id);
    }
    // Mark new solution
    const { error } = await supabase.from("community_replies").update({ is_solution: true }).eq("id", replyId);
    if (error) { toast.error("Failed to mark solution"); return; }
    // Mark post as solved
    await supabase.from("community_posts").update({ solved: true }).eq("id", postId);
    setReplies((prev) => prev.map((r) => ({ ...r, is_solution: r.id === replyId })));
    setSolved(true);
    toast.success("Marked as solution");
  }

  async function unmarkSolution(replyId: string) {
    const supabase = createClient();
    await supabase.from("community_replies").update({ is_solution: false }).eq("id", replyId);
    await supabase.from("community_posts").update({ solved: false }).eq("id", postId);
    setReplies((prev) => prev.map((r) => ({ ...r, is_solution: r.id === replyId ? false : r.is_solution })));
    setSolved(false);
  }

  const isPostOwner = currentUserId === postOwnerId;
  const isHelpPost = postType === "help";

  return (
    <div className="space-y-6">
      <h2 className="font-semibold">{replies.length} {replies.length === 1 ? "Reply" : "Replies"}</h2>

      {replies.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded-xl bg-muted/30">
          No replies yet — be the first to respond.
        </p>
      )}

      {replies.map((reply) => (
        <div
          key={reply.id}
          className={cn(
            "rounded-xl border p-4 group",
            reply.is_solution ? "border-green-400 bg-green-50/50 dark:bg-green-950/20" : "bg-card"
          )}
        >
          {reply.is_solution && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 mb-2">
              <CheckCircle2 size={13} /> Solution
            </div>
          )}
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={reply.avatar_url ?? undefined} />
              <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
                {reply.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/sellers/${reply.username}`} className="text-sm font-medium hover:underline">
                  {reply.username}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {new Date(reply.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              {reply.photos.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {reply.photos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                        <Image src={url} alt="Reply photo" fill className="object-cover" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
              {isHelpPost && isPostOwner && !reply.is_solution && (
                <button
                  onClick={() => markSolution(reply.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-green-700 transition-colors"
                >
                  <CheckCircle2 size={12} /> Mark as solution
                </button>
              )}
              {isHelpPost && isPostOwner && reply.is_solution && (
                <button
                  onClick={() => unmarkSolution(reply.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-green-700 hover:text-muted-foreground transition-colors"
                >
                  <CheckCircle2 size={12} /> Unmark solution
                </button>
              )}
            </div>
            {currentUserId === reply.user_id && (
              <button
                onClick={() => handleDelete(reply.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-all shrink-0"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Reply form */}
      {currentUserId ? (
        <div className="border rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium">Leave a reply</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your thoughts or advice..."
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((url) => (
                  <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                    <Image src={url} alt="Reply photo" fill className="object-cover" />
                    <button type="button" onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {photos.length < MAX_PHOTOS && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Add photo
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { if (e.target.files?.length) handlePhotoUpload(e.target.files); e.target.value = ""; }} />
              </div>
              <Button type="submit" size="sm" disabled={isPending || uploading || !body.trim()} className="bg-green-700 hover:bg-green-800">
                {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                Reply
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="border rounded-xl p-4 text-sm text-muted-foreground text-center">
          <Link href="/login" className="text-green-700 hover:underline">Sign in</Link> to leave a reply.
        </div>
      )}
    </div>
  );
}
