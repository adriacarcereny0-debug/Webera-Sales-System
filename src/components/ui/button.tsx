import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "sm" | "md";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none cursor-pointer",
    "transition-[background-color,box-shadow,color,transform] duration-150 ease-[var(--ease-out)] active:translate-y-px",
    "disabled:cursor-not-allowed disabled:opacity-55 disabled:active:translate-y-0 aria-disabled:pointer-events-none aria-disabled:opacity-55",
    size === "md" ? "h-11 md:h-9 px-3.5 text-[0.9rem] md:text-sm" : "h-9 md:h-8 px-2.5 text-[0.85rem]",
    variant === "primary" && "bg-brand text-brand-contrast shadow-[inset_0_-1px_0_rgb(0_0_0/0.18)] hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]",
    variant === "secondary" && "bg-sheet text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper hover:ring-[color-mix(in_oklab,var(--rule-strong)_70%,var(--ink))]",
    variant === "ghost" && "text-ink-2 hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-ink",
    variant === "quiet" && "text-brand hover:bg-brand-soft",
    variant === "danger" && "bg-danger text-white hover:bg-[color-mix(in_oklab,var(--danger)_85%,black)]",
    extra,
  );
}

type BtnProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };
export function Button({ variant, size, className, type = "button", ...rest }: BtnProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

type LinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };
export function ButtonLink({ variant, size, className, ...rest }: LinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
