import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-mid",
  secondary: "bg-card text-text border border-border hover:bg-muted",
  ghost: "text-text-2 hover:bg-muted hover:text-text",
  danger: "bg-error-pale text-error hover:brightness-95",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-11 px-3 text-sm",
  icon: "size-11",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
