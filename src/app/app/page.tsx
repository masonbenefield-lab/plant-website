import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

// Native app store listings
const APP_STORE_URL = "https://apps.apple.com/app/id6783417415";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=shop.plantet.app";

export const metadata: Metadata = {
  title: "Get the Plantet App",
  description:
    "Download Plantet for iPhone and Android — track your plants, connect with growers, and buy or sell in one app.",
  openGraph: {
    title: "Get the Plantet App",
    description:
      "Download Plantet for iPhone and Android — track your plants, connect with growers, and buy or sell in one app.",
    images: ["/plantet-app-icon-1024.png"],
  },
};

// The Plantet sprout mark (matches the homepage logo)
function SproutMark({ size = 64 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width={size} height={size}>
      <g transform="translate(8 4)">
        <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" strokeWidth="6" strokeLinecap="round" />
        <g transform="translate(40 58) rotate(38)">
          <path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A" />
        </g>
        <g transform="translate(40 50) rotate(-38)">
          <path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9" />
        </g>
      </g>
    </svg>
  );
}

export default async function AppRedirectPage() {
  // Server-side device detection — instant redirect for phones, no flicker.
  const ua = (await headers()).get("user-agent") ?? "";

  if (/iphone|ipad|ipod/i.test(ua)) redirect(APP_STORE_URL);
  if (/android/i.test(ua)) redirect(PLAY_STORE_URL);

  // Desktop (and anything else): bridge them to their phone with a QR code.
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-16 text-white"
      style={{ background: "linear-gradient(160deg, #235140, #19392B)" }}
    >
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-5">
          <SproutMark size={60} />
        </div>

        <span className="inline-block bg-white/20 text-white text-[11px] font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
          Now on iOS &amp; Android
        </span>

        <h1
          className="text-3xl sm:text-4xl font-bold mb-3 tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
        >
          Get the Plantet app
        </h1>
        <p className="text-cream/80 mb-7 text-base leading-relaxed">
          Track your plants, connect with fellow growers, and buy or sell — right from your phone.
        </p>

        {/* QR code — the key desktop → mobile bridge */}
        <div className="bg-white rounded-3xl p-6 inline-flex flex-col items-center gap-3 mb-7 shadow-xl">
          <Image
            src="/app-qr.png"
            alt="Scan to download the Plantet app"
            width={190}
            height={190}
            className="rounded-lg"
          />
          <p className="text-[#1F4736] text-sm font-semibold">
            📱 Scan with your phone to download
          </p>
        </div>

        {/* Store badges */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <a
            href={APP_STORE_URL}
            className="flex items-center justify-center gap-2.5 bg-black text-white rounded-xl px-5 py-2.5 hover:bg-neutral-800 transition-colors"
          >
            <svg viewBox="0 0 384 512" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C61.5 141.2 0 184.5 0 272.5c0 26 4.8 52.9 14.3 80.6 12.7 36.5 58.9 126 107.1 124.5 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82 102.5-118.6-65.2-30.7-61.7-90-61.7-91.8zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
            <span className="text-left leading-none">
              <span className="block text-[10px] text-white/70">Download on the</span>
              <span className="block text-base font-semibold -mt-0.5">App Store</span>
            </span>
          </a>

          <a
            href={PLAY_STORE_URL}
            className="flex items-center justify-center gap-2.5 bg-black text-white rounded-xl px-5 py-2.5 hover:bg-neutral-800 transition-colors"
          >
            <svg viewBox="0 0 512 512" width="20" height="20" aria-hidden="true">
              <path fill="#34d399" d="M47 20 L296 256 L47 492 C39 490 33 483 33 473 V39 C33 29 39 22 47 20 Z" />
              <path fill="#f6f2e9" d="M296 256 L47 20 L360 200 Z" />
              <path fill="#a8c19a" d="M296 256 L360 312 L47 492 Z" />
              <path fill="#235140" d="M360 200 L440 246 C452 253 452 259 440 266 L360 312 L296 256 Z" />
            </svg>
            <span className="text-left leading-none">
              <span className="block text-[10px] text-white/70">Get it on</span>
              <span className="block text-base font-semibold -mt-0.5">Google Play</span>
            </span>
          </a>
        </div>

        <Link href="/" className="text-sm text-cream/60 hover:text-cream transition-colors underline underline-offset-2">
          Continue to plantet.shop →
        </Link>
      </div>
    </main>
  );
}
