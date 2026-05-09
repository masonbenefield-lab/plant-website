"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageSquare, Loader2 } from "lucide-react";

export function MessageButton({ recipientId }: { recipientId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        toast.error("Could not start conversation");
        return;
      }

      const { conversationId } = await res.json();
      router.push(`/messages/${conversationId}`);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending} className="gap-1.5">
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
      Message
    </Button>
  );
}
