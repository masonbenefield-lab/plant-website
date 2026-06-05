"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 text-sm font-medium border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors print:hidden"
    >
      🖨️ Print / Save as PDF
    </button>
  );
}
