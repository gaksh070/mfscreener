import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[8px] text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)] text-white hover:opacity-90",
        secondary: "bg-white border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg-alt)]",
        ghost: "text-[var(--ink)] hover:bg-[var(--bg-alt)]",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px]",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
