"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

export default function AppInstallPage() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void } | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as Event & { prompt: () => void });
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-6 py-16 max-w-md mx-auto">

      {/* Icon + heading */}
      <div className="flex flex-col items-center text-center space-y-4 mb-10">
        <Image
          src="/plantet-app-icon.png"
          alt="Plantet app icon"
          width={96}
          height={96}
          className="rounded-2xl shadow-md"
        />
        <div>
          <h1 className="text-2xl font-bold">Get the Plantet App</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Add Plantet to your home screen for the best experience.
          </p>
        </div>
      </div>

      {/* iOS instructions */}
      {platform === "ios" && (
        <div className="w-full space-y-4">
          <p className="text-sm font-semibold text-center text-muted-foreground uppercase tracking-wide mb-2">
            iPhone / iPad
          </p>
          {[
            { step: "1", text: 'Open plantet.shop in Safari (not Chrome).' },
            {
              step: "2",
              text: (
                <>
                  Tap the{" "}
                  <span className="inline-flex items-center gap-1 font-medium">
                    Share
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </span>{" "}
                  button at the bottom of the screen.
                </>
              ),
            },
            { step: "3", text: 'Scroll down and tap "Add to Home Screen."' },
            { step: "4", text: 'Tap "Add" in the top right. Done!' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-4 bg-muted/50 rounded-xl p-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2F7D54] text-white text-sm font-bold flex items-center justify-center">
                {step}
              </span>
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
          ))}

          <p className="text-xs text-muted-foreground text-center pt-2">
            The Plantet icon will appear on your home screen just like any other app.
          </p>
        </div>
      )}

      {/* Android instructions */}
      {platform === "android" && (
        <div className="w-full space-y-6">
          {installed ? (
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">You&apos;re all set!</p>
              <p className="text-sm text-muted-foreground">Plantet has been added to your home screen.</p>
            </div>
          ) : deferredPrompt ? (
            <button
              onClick={handleAndroidInstall}
              className="w-full py-3 rounded-full bg-[#2F7D54] text-white font-semibold text-sm hover:bg-[#1F4736] transition-colors"
            >
              Add Plantet to Home Screen
            </button>
          ) : (
            <div className="w-full space-y-4">
              <p className="text-sm font-semibold text-center text-muted-foreground uppercase tracking-wide mb-2">
                Android
              </p>
              {[
                { step: "1", text: "Open plantet.shop in Chrome." },
                { step: "2", text: 'Tap the three-dot menu in the top right corner.' },
                { step: "3", text: 'Tap "Add to Home screen."' },
                { step: "4", text: 'Tap "Add." Done!' },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-4 bg-muted/50 rounded-xl p-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#2F7D54] text-white text-sm font-bold flex items-center justify-center">
                    {step}
                  </span>
                  <p className="text-sm leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desktop fallback */}
      {platform === "other" && (
        <div className="w-full space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Open this page on your iPhone or Android phone to install the app.
          </p>
          <div className="border rounded-xl p-5 text-sm space-y-1">
            <p className="font-semibold">plantet.shop/app</p>
            <p className="text-muted-foreground text-xs">Scan or type this into your phone&apos;s browser</p>
          </div>
        </div>
      )}
    </div>
  );
}
