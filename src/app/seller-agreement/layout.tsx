import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seller Agreement — Plantet",
  description: "Read the Plantet Seller Agreement before listing plants or supplies on our marketplace.",
  openGraph: {
    title: "Seller Agreement — Plantet",
    description: "Read the Plantet Seller Agreement before listing plants or supplies on our marketplace.",
  },
};

export default function SellerAgreementLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
