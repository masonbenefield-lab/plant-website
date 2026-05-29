"use client";

export function LocalDate({ iso }: { iso: string }) {
  return <>{new Date(iso).toLocaleString()}</>;
}
