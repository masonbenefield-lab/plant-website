import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { Resend } from "resend";

const FROM = "Plantet <noreply@plantet.shop>";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ ok: true }); // always 200 — don't reveal if email exists
  }

  try {
    const admin = createAdmin<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Use database function to look up username by email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: username } = await (admin as any).rpc("get_username_by_email", { p_email: email.toLowerCase().trim() });

    if (username) {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Your Plantet username",
        html: `
          <p>Hi there,</p>
          <p>You requested your Plantet username. Here it is:</p>
          <p style="font-size:20px;font-weight:bold;margin:16px 0;">${username}</p>
          <p>You can sign in at <a href="${process.env.NEXT_PUBLIC_APP_URL}/login">${process.env.NEXT_PUBLIC_APP_URL}/login</a>.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>— The Plantet team</p>
        `,
      });
    }
  } catch {
    // Silently swallow errors — always return 200
  }

  return NextResponse.json({ ok: true });
}
