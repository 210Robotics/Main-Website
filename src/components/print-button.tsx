"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      className="button secondary print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  );
}
