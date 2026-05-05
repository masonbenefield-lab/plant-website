import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeUnsubToken } from "@/lib/email";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.com").replace(/\/$/, "");

function html(heading: string, body: string, showShopLink: boolean) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${heading} — Plantet</title>
  <style>
    body{margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .card{background:#fff;border-radius:16px;padding:48px 40px;max-width:420px;width:100%;box-shadow:0 2px 8px rgba(0,0,0,.07);text-align:center;}
    .icon{font-size:40px;margin-bottom:16px;}
    h1{margin:0 0 12px;font-size:22px;color:#111827;}
    p{margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;}
    a.btn{display:inline-block;background:#15803d;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;}
    a.subtle{font-size:13px;color:#9ca3af;text-decoration:none;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${showShopLink ? "✅" : "❌"}</div>
    <h1>${heading}</h1>
    <p>${body}</p>
    ${showShopLink
      ? `<a class="btn" href="${siteUrl}/shop">Browse the shop</a>`
      : `<a class="subtle" href="${siteUrl}">Back to Plantet</a>`}
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get("uid");
  const sig = searchParams.get("sig");

  if (!uid || !sig) {
    return new NextResponse(html("Invalid link", "This unsubscribe link is missing required parameters.", false), {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  if (sig !== makeUnsubToken(uid)) {
    return new NextResponse(html("Invalid link", "This unsubscribe link is invalid or has expired.", false), {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  const { error } = await admin
    .from("profiles")
    .update({ email_marketing_opt_in: false })
    .eq("id", uid);

  if (error) {
    return new NextResponse(html("Something went wrong", "We couldn't process your request. Please try again or update your preference from Account Settings.", false), {
      status: 500, headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(
    html(
      "You've been unsubscribed",
      "You'll no longer receive monthly plant digests from Plantet. You can re-enable this anytime from your account settings.",
      true
    ),
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
