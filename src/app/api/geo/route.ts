import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const country = request.headers.get("x-vercel-ip-country") ?? null;
  return NextResponse.json({ country });
}
