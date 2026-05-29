import { NextResponse } from "next/server";
import { buildWelcomeHtml } from "@/lib/email";

export async function GET() {
  const html = buildWelcomeHtml({ username: "plant_lover" });
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
