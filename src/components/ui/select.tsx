"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { CaretDown, Check } from "@phosphor-icons/react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "inline-flex h-9 items-center justify-between gap-2 rounded-[8px] border border-[var(--line)] bg-white px-3 text-sm text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <CaretDown size={14} weight="bold" className="text-[var(--ink-soft)]" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-[8px] border border-[var(--line)] bg-white shadow-md",
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-[6px] px-2 py-1.5 text-sm text-[var(--ink)] outline-none data-[highlighted]:bg-[var(--accent-soft)]",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2">
        <Check size={14} weight="bold" className="text-[var(--accent)]" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
