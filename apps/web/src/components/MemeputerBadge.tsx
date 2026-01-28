"use client";

export function MemeputerBadge() {
  return (
    <div className="flex items-center gap-3 text-sm text-foreground/70">
      <a
        href="https://memeputer.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-display hover:text-foreground transition-colors"
      >
        a <span className="font-bold">MEMEPUTER</span> product
      </a>
      <span className="text-foreground/30">•</span>
      <a
        href="https://openfacilitator.io"
        target="_blank"
        rel="noopener noreferrer"
        className="font-sans hover:text-foreground transition-colors"
      >
        Powered by <span className="font-semibold">OpenFacilitator</span>
      </a>
    </div>
  );
}
