"use client";

import { useState } from "react";

interface EmailEntry {
  id: string;
  label: string;
  category: string;
  html: string;
}

export function EmailPreviewClient({ emails }: { emails: EmailEntry[] }) {
  const [selected, setSelected] = useState(emails[0]?.id ?? "");
  const current = emails.find((e) => e.id === selected);
  const categories = Array.from(new Set(emails.map((e) => e.category)));

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <nav className="w-64 shrink-0 border-r overflow-y-auto flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-bold text-sm">Email Templates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{emails.length} templates</p>
        </div>
        <div className="p-2 flex-1">
          {categories.map((cat) => (
            <div key={cat} className="mb-3">
              <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{cat}</p>
              {emails
                .filter((e) => e.category === cat)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelected(e.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                      selected === e.id
                        ? "bg-green-100 text-green-800 font-medium dark:bg-green-900/30 dark:text-green-300"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    {e.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Preview pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b px-6 py-3 flex items-center gap-3">
          <span className="font-medium text-sm">{current?.label}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{current?.category}</span>
        </div>
        {current && (
          <iframe
            key={current.id}
            srcDoc={current.html}
            className="flex-1 w-full border-0"
            title={current.label}
            sandbox="allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}
