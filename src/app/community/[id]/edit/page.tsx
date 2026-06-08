"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function EditCommunityPost() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      const { data: post } = await supabase
        .from("community_posts")
        .select("title, body, user_id")
        .eq("id", id)
        .single();
      if (!post || post.user_id !== user.id) { router.replace(`/community/${id}`); return; }
      setTitle(post.title);
      setBody(post.body ?? "");
      setLoading(false);
    });
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast.error("Title is required"); return; }
    startTransition(async () => {
      const res = await fetch("/api/community/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id, title, body }),
      });
      if (!res.ok) { toast.error("Failed to save changes"); return; }
      toast.success("Post updated");
      router.push(`/community/${id}`);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Post</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body">Details (optional)</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={2000}
            className="resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isPending || !title.trim()} className="bg-leaf hover:bg-forest">
            {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Save changes
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
