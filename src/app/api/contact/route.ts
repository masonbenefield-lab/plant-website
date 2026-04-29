import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const { name, email, message } = await request.json() as {
    name: string;
    email: string;
    message: string;
  };

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (message.length > 1000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from: "Plantet <noreply@plantet.shop>",
      to: "masonbenefield@gmail.com",
      replyTo: email,
      subject: `New contact message from ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message — please try again later" }, { status: 500 });
  }
}
