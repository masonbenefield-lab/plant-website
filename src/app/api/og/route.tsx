import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function renderImage(jsx: React.ReactElement): Promise<Response> {
  const res = new ImageResponse(jsx, { width: 1200, height: 630 });
  const buf = await res.arrayBuffer();
  return new Response(buf, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
}

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
      .select("plant_name, variety, current_bid_cents, buy_now_price_cents, images, category, seller_id")
      .eq("id", id)
      .single();

    if (data) {
      plantName = data.plant_name;
      variety = data.variety ?? "";
      priceLine = `Current bid: $${(data.current_bid_cents / 100).toFixed(2)}`;
      if (data.buy_now_price_cents) {
        buyNowLine = `Buy Now: $${(data.buy_now_price_cents / 100).toFixed(2)}`;
      }
      imageUrl = (data.images as string[])?.[0] ?? "";
      category = data.category ?? "";
      const { data: seller } = await supabase.from("profiles").select("username, display_name").eq("id", data.seller_id).single();
      sellerDisplay = seller?.display_name || (seller?.username ? `@${seller.username}` : "");
    }
  }

  if (!plantName) return new Response("Not found", { status: 404 });

  // Pre-fetch plant image using Supabase render endpoint (small resized copy).
  let imageSrc = "";
  if (imageUrl) {
    try {
      const fetchUrl = imageUrl.includes("/storage/v1/object/public/")
        ? imageUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=400&quality=75"
        : imageUrl;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const imgRes = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (imgRes.ok) {
        const mime = imgRes.headers.get("content-type") ?? "";
        if (mime.startsWith("image/")) {
          const buf = await imgRes.arrayBuffer();
          if (buf.byteLength <= 800 * 1024) {
            imageSrc = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
          }
        }
      }
    } catch {
      // proceed without photo
    }
  }

  // Satori CSS rules:
  // - no multi-value shorthands (use paddingTop/Right/Bottom/Left individually)
  // - lineHeight must be a number (not a string)
  // - borderRadius % values may not work — use px
  // - no border shorthand — use borderWidth/Style/Color
  // - flex:1 shorthand is fine
  // - &&/|| conditionals are fine; so are ternaries

  const jsx = (
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
          }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, color: "white", overflow: "hidden" }}>
        {/* Badges — use individual padding props, no multi-value shorthand */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", alignItems: "center" }}>
          {isAuction && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "#dc2626",
                borderRadius: "100px",
                paddingTop: 5,
                paddingBottom: 5,
                paddingLeft: 16,
                paddingRight: 16,
                fontSize: "16px",
                fontWeight: "700",
                color: "white",
              }}
            >
              LIVE AUCTION
            </div>
          )}
          {category && (
            <div
              style={{
                display: "flex",
                background: "rgba(255,255,255,0.15)",
                borderRadius: "100px",
                paddingTop: 5,
                paddingBottom: 5,
                paddingLeft: 16,
                paddingRight: 16,
                fontSize: "16px",
                color: "#bbf7d0",
              }}
            >
              {category}
            </div>
          )}
        </div>
        {/* lineHeight must be a number in Satori */}
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
            {`by ${sellerDisplay}`}
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
        }}
      >
        plantet.shop
      </div>
    </div>
  );

  try {
    return await renderImage(jsx);
  } catch (e) {
    return new Response(`OG render error: ${e}`, { status: 500 });
  }
}
