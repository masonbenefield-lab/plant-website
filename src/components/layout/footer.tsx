import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t py-8 px-4 text-sm text-muted-foreground">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-bold text-green-700 text-base">Plantet</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          <Link href="/auctions" className="hover:text-foreground transition-colors">Auctions</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/signup" className="hover:text-foreground transition-colors">Sell</Link>
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/seller-agreement" className="hover:text-foreground transition-colors">Seller Agreement</Link>
          <a href="mailto:support@plantet.app" className="hover:text-foreground transition-colors">Contact</a>
        </nav>
        <span className="text-xs">&copy; {new Date().getFullYear()} Plantet</span>
      </div>
    </footer>
  );
}
