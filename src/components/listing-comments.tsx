"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
};

interface Props {
  listingId: string;
  sellerId: string;
  currentUserId: string | null;
  initialComments: Comment[];
}

export function ListingComments({ listingId, sellerId, currentUserId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in to comment"); return; }

      const { data, error } = await supabase
        .from("listing_comments")
        .insert({ listing_id: listingId, user_id: user.id, body: body.trim() })
        .select("id, body, created_at, user_id")
        .single();

      if (error) { toast.error("Failed to post comment"); return; }

      // Fetch commenter's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();

      setComments((prev) => [{
        ...data,
        username: profile?.username ?? "unknown",
        avatar_url: profile?.avatar_url ?? null,
      }, ...prev]);
      setBody("");
    });
  }

  async function handleDelete(commentId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("listing_comments").delete().eq("id", commentId);
    if (error) { toast.error("Failed to delete comment"); return; }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  return (
    <div className="mt-12 space-y-6">
      <h2 className="text-lg font-semibold">Questions & Comments ({comments.length})</h2>

      {/* Comment form */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask a question or leave a comment..."
            rows={3}
            maxLength={500}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{body.length}/500</span>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !body.trim()}
              className="bg-leaf hover:bg-forest"
            >
              {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
              Post
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="text-leaf hover:underline">Sign in</Link> to ask a question or leave a comment.
        </p>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No comments yet. Be the first to ask a question.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-[#DFE7D4] text-leaf text-xs font-semibold">
                  {c.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
                {c.avatar_url && <AvatarImage src={c.avatar_url} />}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">
                    {c.user_id === sellerId ? (
                      <span className="text-leaf">{c.username} <span className="text-xs font-normal text-leaf">(Seller)</span></span>
                    ) : c.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
              {(currentUserId === c.user_id || currentUserId === sellerId) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-all shrink-0 mt-0.5"
                  title="Delete comment"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
