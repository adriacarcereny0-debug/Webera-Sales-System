import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number, disabled: boolean, children: React.ReactNode, label: string) =>
    disabled ? (
      <span aria-disabled className="inline-flex size-9 items-center justify-center rounded-md text-faint">{children}</span>
    ) : (
      <Link href={hrefFor(p)} aria-label={label} className="inline-flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-paper hover:text-ink">{children}</Link>
    );
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 text-sm text-muted md:px-5">
      <p className="num">{from}–{to} de {total}</p>
      <div className="flex items-center gap-1">
        {link(page - 1, page <= 1, <ChevronLeft className="size-4" strokeWidth={1.75} />, "Página anterior")}
        <span className={cn("num px-2 text-ink-2")}>Página {page} de {pages}</span>
        {link(page + 1, page >= pages, <ChevronRight className="size-4" strokeWidth={1.75} />, "Página siguiente")}
      </div>
    </nav>
  );
}
