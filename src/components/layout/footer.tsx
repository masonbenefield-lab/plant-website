import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t py-8 px-4 text-sm text-muted-foreground">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-bold text-leaf text-base">Plantet</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          <Link href="/auctions" className="hover:text-foreground transition-colors">Auctions</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/signup" className="hover:text-foreground transition-colors">Sell</Link>
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/seller-agreement" className="hover:text-foreground transition-colors">Seller Agreement</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </nav>
        <div className="flex flex-col items-center sm:items-end gap-1">
          <span className="text-xs">&copy; {new Date().getFullYear()} Plantet</span>
          <a href="https://ko-fi.com/plantet" target="_blank" rel="noopener noreferrer" className="text-xs hover:text-foreground transition-colors">Love Plantet? Support us on Ko-fi ☕</a>
        </div>
      </div>
    </footer>
  );
}
