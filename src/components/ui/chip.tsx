"use client";

import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function Chip({
  children,
  onRemove,
  className,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mfs-chip inline-flex items-center gap-1.5 bg-[var(--accent-soft)] px-3 py-1 text-[13px] font-medium text-[var(--accent)]",
        className
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="rounded-full p-0.5 hover:bg-white/60"
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </span>
  );
}
