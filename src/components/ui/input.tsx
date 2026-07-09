import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        className
      )}
      {...props}
    />
  );
}
