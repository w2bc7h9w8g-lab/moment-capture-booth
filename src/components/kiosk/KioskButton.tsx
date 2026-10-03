import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-gold-gradient text-primary-foreground shadow-gold hover:brightness-110",
  outline: "border-2 border-primary text-primary bg-transparent hover:bg-primary/10",
  ghost: "text-muted-foreground hover:text-foreground bg-secondary/60",
  danger: "bg-destructive text-destructive-foreground hover:brightness-110",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "lg" | "xl";
}

export function KioskButton({ variant = "primary", size = "lg", className, ...rest }: Props) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex min-h-20 items-center justify-center gap-3 rounded-full font-bold uppercase tracking-[0.2em] transition active:scale-95 disabled:pointer-events-none disabled:opacity-40",
        size === "xl" ? "px-16 py-7 text-2xl md:text-3xl" : "px-10 py-5 text-lg md:text-xl",
        variants[variant],
        className,
      )}
    />
  );
}
