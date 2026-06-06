import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — Plantet",
  description: "Get in touch with the Plantet team. We're here to help with questions about buying, selling, or anything else on the platform.",
  openGraph: {
    title: "Contact Us — Plantet",
    description: "Get in touch with the Plantet team.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
