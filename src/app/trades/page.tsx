export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-[#DFE7D4] text-forest",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function TradesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: received }, { data: sent }] = await Promise.all([
    supabase
      .from("trade_offers")
      .select("id, proposer_id, offer_description, want_description, status, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("trade_offers")
      .select("id, recipient_id, offer_description, want_description, status, created_at")
      .eq("proposer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const proposerIds = [...new Set((received ?? []).map((t) => t.proposer_id))];
  const recipientIds = [...new Set((sent ?? []).map((t) => t.recipient_id))];
  const allIds = [...new Set([...proposerIds, ...recipientIds])];

  const { data: profiles } = allIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", allIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  function renderTrade(
    trade: { id: string; offer_description: string; want_description: string; status: string; created_at: string },
    otherUserId: string,
    direction: "received" | "sent"
  ) {
    const other = profileMap[otherUserId];
    return (
      <Link key={trade.id} href={`/trades/${trade.id}`}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  {direction === "received" ? "From" : "To"}{" "}
                  <span className="font-medium text-foreground">{other?.username ?? "Unknown"}</span>
                </p>
                <p className="font-semibold text-sm leading-snug truncate">
                  Offering: {trade.offer_description}
                </p>
                <p className="text-sm text-muted-foreground leading-snug truncate">
                  Wants: {trade.want_description}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {new Date(trade.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <Badge variant="secondary" className={cn(statusColor[trade.status] ?? "")}>
                {trade.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const pendingReceived = (received ?? []).filter((t) => t.status === "pending");
  const otherReceived = (received ?? []).filter((t) => t.status !== "pending");
  const pendingSent = (sent ?? []).filter((t) => t.status === "pending");
  const otherSent = (sent ?? []).filter((t) => t.status !== "pending");

  const hasAny = (received ?? []).length > 0 || (sent ?? []).length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Trades</h1>
        <Link
          href="/gardens"
          className="text-sm text-leaf hover:underline font-medium"
        >
          Browse Gardens →
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Trade plants with other growers. Click a trade to view details and chat.
      </p>

      {!hasAny ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <ArrowLeftRight className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">No trades yet</p>
            <p className="text-sm text-muted-foreground">
              Browse public gardens and click <strong>Trades</strong> on a grower&apos;s card to propose one.
            </p>
            <Link href="/gardens" className="inline-block mt-2 text-sm text-leaf hover:underline font-medium">
              Browse Gardens →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {/* Received */}
          {(received ?? []).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Received
              </h2>
              <div className="space-y-3">
                {pendingReceived.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium">Pending ({pendingReceived.length})</p>
                    {pendingReceived.map((t) => renderTrade(t, t.proposer_id, "received"))}
                  </>
                )}
                {otherReceived.length > 0 && (
                  <>
                    {pendingReceived.length > 0 && <p className="text-xs text-muted-foreground font-medium pt-2">History</p>}
                    {otherReceived.map((t) => renderTrade(t, t.proposer_id, "received"))}
                  </>
                )}
              </div>
            </section>
          )}

          {/* Sent */}
          {(sent ?? []).length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Sent
              </h2>
              <div className="space-y-3">
                {pendingSent.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground font-medium">Pending ({pendingSent.length})</p>
                    {pendingSent.map((t) => renderTrade(t, t.recipient_id, "sent"))}
                  </>
                )}
                {otherSent.length > 0 && (
                  <>
                    {pendingSent.length > 0 && <p className="text-xs text-muted-foreground font-medium pt-2">History</p>}
                    {otherSent.map((t) => renderTrade(t, t.recipient_id, "sent"))}
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
