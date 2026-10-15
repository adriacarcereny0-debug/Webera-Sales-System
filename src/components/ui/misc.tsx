import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, meta }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {meta && <div className="mb-2 text-sm text-muted">{meta}</div>}
        <h1 className="text-[1.65rem] leading-[1.15] font-semibold tracking-[-0.025em] text-ink text-balance md:text-[2rem]">{title}</h1>
        {description && <p className="mt-2 max-w-[68ch] text-[0.98rem] leading-relaxed text-muted text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Hoja: superficie blanca sobre el papel, con regla fina. */
export function Sheet({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside" }) {
  return <As className={cn("rounded-lg bg-sheet shadow-sheet ring-1 ring-rule", className)}>{children}</As>;
}

export function SheetHeader({ title, actions, description, id }: { title: ReactNode; actions?: ReactNode; description?: ReactNode; id?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3 md:px-5">
      <div className="min-w-0">
        <h2 id={id} className="text-[0.95rem] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[0.82rem] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-[46ch] text-sm text-muted text-pretty">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const NOTICE_STYLES = {
  info: { cls: "tint-azul", Icon: Info },
  ok: { cls: "tint-verde", Icon: CircleCheck },
  warn: { cls: "tint-amarilla", Icon: TriangleAlert },
  error: { cls: "tint-rosa", Icon: CircleAlert },
} as const;

export function Notice({ kind = "info", title, children, className }: { kind?: keyof typeof NOTICE_STYLES; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon } = NOTICE_STYLES[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn(cls, "tint-chip flex gap-3 rounded-md px-3.5 py-3 text-sm", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title ? "mt-0.5" : null, "text-pretty")}>{children}</div>}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-rule-strong bg-paper px-1.5 py-0.5 font-sans text-[0.75rem] text-ink-2">{children}</kbd>;
}

export function Definition({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7.5rem,38%)_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{term}</dt>
      <dd className="min-w-0 break-words text-ink">{children ?? <span className="text-faint">—</span>}</dd>
    </div>
  );
}
