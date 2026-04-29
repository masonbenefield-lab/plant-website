import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t mt-auto py-6 px-4 text-sm text-muted-foreground">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="font-medium text-foreground">Plantet</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/seller-agreement" className="hover:text-foreground transition-colors">Seller Agreement</Link>
          <a href="mailto:support@plantet.app" className="hover:text-foreground transition-colors">Contact</a>
        </nav>
        <span className="text-xs">&copy; {new Date().getFullYear()} Plantet. All rights reserved.</span>
      </div>
    </footer>
  );
}
