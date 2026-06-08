import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradeChat } from "./trade-chat";
import { TradeActions } from "./trade-actions";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-[#DFE7D4] text-forest",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function TradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trade } = await supabase
    .from("trade_offers")
    .select("id, proposer_id, recipient_id, offer_description, want_description, status, created_at")
    .eq("id", id)
    .single();

  if (!trade) notFound();

  const isProposer = user.id === trade.proposer_id;
  const isRecipient = user.id === trade.recipient_id;
  if (!isProposer && !isRecipient) notFound();

  const otherId = isProposer ? trade.recipient_id : trade.proposer_id;

  const [{ data: otherProfile }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).single(),
    supabase
      .from("trade_messages")
      .select("id, trade_id, sender_id, body, created_at")
      .eq("trade_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/dashboard/offers?tab=trades"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft size={16} />
        Trades
      </Link>

      {/* Trade summary */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={16} className="text-leaf shrink-0" />
              <span className="font-semibold">
                Trade with{" "}
                <Link
                  href={`/sellers/${otherProfile?.username}`}
                  className="text-leaf hover:underline"
                >
                  {otherProfile?.username ?? "Unknown"}
                </Link>
              </span>
            </div>
            <Badge variant="secondary" className={cn(statusColor[trade.status] ?? "")}>
              {trade.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {isProposer ? "You're offering" : `${otherProfile?.username} is offering`}
              </p>
              <p className="leading-relaxed">{trade.offer_description}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {isProposer ? "You want" : `${otherProfile?.username} wants`}
              </p>
              <p className="leading-relaxed">{trade.want_description}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Proposed{" "}
            {new Date(trade.created_at).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>

          {trade.status === "pending" && (
            <div className="mt-4 pt-4 border-t">
              <TradeActions
                tradeId={trade.id}
                isRecipient={isRecipient}
                isProposer={isProposer}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat */}
      <TradeChat
        tradeId={trade.id}
        currentUserId={user.id}
        currentUsername={myProfile?.username ?? "you"}
        currentAvatarUrl={myProfile?.avatar_url ?? null}
        otherUsername={otherProfile?.username ?? "them"}
        otherAvatarUrl={otherProfile?.avatar_url ?? null}
        initialMessages={messages ?? []}
        tradeClosed={trade.status !== "pending"}
      />
    </div>
  );
}
