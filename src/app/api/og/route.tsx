import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "listing";
  const id = searchParams.get("id");

  if (!id) return new Response("Missing id", { status: 400 });

  let plantName = "";
  let variety = "";
  let priceLine = "";
  let buyNowLine = "";
  let imageUrl = "";
  let sellerDisplay = "";
  let category = "";
  let isAuction = false;

  if (type === "listing") {
    const { data } = await supabase
      .from("listings")
      .select("plant_name, variety, price_cents, images, category, seller_id")
      .eq("id", id)
      .single();

    if (data) {
      plantName = data.plant_name;
      variety = data.variety ?? "";
      priceLine = `$${(data.price_cents / 100).toFixed(2)}`;
      imageUrl = (data.images as string[])?.[0] ?? "";
      category = data.category ?? "";
      const { data: seller } = await supabase.from("profiles").select("username, display_name").eq("id", data.seller_id).single();
      sellerDisplay = seller?.display_name || (seller?.username ? `@${seller.username}` : "");
    }
  } else {
    isAuction = true;
    const { data } = await supabase
      .from("auctions")
      .select("plant_name, variety, current_bid_cents, buy_now_cents, images, category, seller_id")
      .eq("id", id)
      .single();

    if (data) {
      plantName = data.plant_name;
      variety = data.variety ?? "";
      priceLine = `Current bid: $${(data.current_bid_cents / 100).toFixed(2)}`;
      if (data.buy_now_cents) {
        buyNowLine = `Buy Now: $${(data.buy_now_cents / 100).toFixed(2)}`;
      }
      imageUrl = (data.images as string[])?.[0] ?? "";
      category = data.category ?? "";
      const { data: seller } = await supabase.from("profiles").select("username, display_name").eq("id", data.seller_id).single();
      sellerDisplay = seller?.display_name || (seller?.username ? `@${seller.username}` : "");
    }
  }

  if (!plantName) return new Response("Not found", { status: 404 });

  // Pre-fetch the plant image as base64 so Satori doesn't make an external
  // request at render time (which can fail silently and crash the whole response)
  let imageSrc = "";
  if (imageUrl) {
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        imageSrc = `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;
      }
    } catch {
      // render without plant photo rather than crashing
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #14532d 0%, #166534 60%, #15803d 100%)",
          padding: "48px",
          gap: "40px",
          alignItems: "center",
          position: "relative",
        }}
      >
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            style={{
              width: "260px",
              height: "260px",
              borderRadius: "20px",
              objectFit: "cover",
              flexShrink: 0,
              border: "3px solid rgba(255,255,255,0.15)",
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, color: "white", overflow: "hidden" }}>
          {/* Badges row */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
            {isAuction && (
              <div
                style={{
                  display: "flex",
                  background: "#dc2626",
                  borderRadius: "100px",
                  padding: "5px 16px",
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "white",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                🔴 Live Auction
              </div>
            )}
            {category && (
              <div
                style={{
                  display: "flex",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "100px",
                  padding: "5px 16px",
                  fontSize: "16px",
                  color: "#bbf7d0",
                }}
              >
                {category}
              </div>
            )}
          </div>

          <div style={{ fontSize: "52px", fontWeight: "bold", lineHeight: 1.1, marginBottom: "8px" }}>
            {plantName}
          </div>
          {variety && (
            <div style={{ fontSize: "26px", color: "#bbf7d0", marginBottom: "16px" }}>
              {variety}
            </div>
          )}
          <div style={{ fontSize: "38px", fontWeight: "bold", color: "#4ade80", marginBottom: buyNowLine ? "6px" : "16px" }}>
            {priceLine}
          </div>
          {buyNowLine && (
            <div style={{ fontSize: "22px", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>
              {buyNowLine}
            </div>
          )}
          {sellerDisplay && (
            <div style={{ fontSize: "20px", color: "rgba(255,255,255,0.65)" }}>
              by {sellerDisplay}
            </div>
          )}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "48px",
            fontSize: "22px",
            color: "rgba(255,255,255,0.4)",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          🌿 plantet.shop
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
