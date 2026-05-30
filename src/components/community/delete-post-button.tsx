"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/community/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (res.ok) {
      toast.success("Post deleted");
      router.push("/community");
      router.refresh();
    } else {
      toast.error("Failed to delete post");
      setDeleting(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete this post?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
    >
      <Trash2 size={13} />
      Delete
    </button>
  );
}
