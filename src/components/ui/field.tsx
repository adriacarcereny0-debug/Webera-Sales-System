import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClass = cn(
  "w-full rounded-md bg-sheet text-ink placeholder:text-faint",
  "ring-1 ring-inset ring-rule-strong px-3 h-11 md:h-9 text-[1rem] md:text-sm",
  "transition-shadow duration-150 hover:ring-[color-mix(in_oklab,var(--rule-strong)_60%,var(--ink))]",
  "focus:outline-none focus:ring-2 focus:ring-brand",
  "aria-[invalid=true]:ring-danger disabled:bg-paper disabled:text-muted",
);

export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-[0.82rem] font-medium text-ink-2">
      {children}
      {optional && <span className="font-normal text-faint">opcional</span>}
    </label>
  );
}

export function Field({
  label, htmlFor, error, hint, optional, children, className,
}: { label: ReactNode; htmlFor?: string; error?: string; hint?: ReactNode; optional?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>{label}</Label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-[0.8rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[0.8rem] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input aria-invalid={invalid || undefined} className={cn(controlClass, className)} {...rest} />;
}

export function Textarea({ className, invalid, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(controlClass, "h-auto min-h-24 py-2 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, invalid, children, ...rest }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select aria-invalid={invalid || undefined} className={cn(controlClass, "select-chevron cursor-pointer appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, className, ...rest }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-[var(--brand)]" {...rest} />
      <span>
        <span className="text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[0.8rem] text-muted">{hint}</span>}
      </span>
    </label>
  );
}
