import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { isQuoteStatus, QUOTE_STATUS, type QuoteStatus } from "@/lib/stages";
import { formatCents } from "@/lib/money";
import { fmtDate, todayMadrid } from "@/lib/dates";
import { PageHeader, Sheet, EmptyState } from "@/components/ui/misc";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { QuoteStatusChip } from "@/components/ui/chip";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitForm } from "@/components/ui/auto-submit";
import { Flash } from "@/components/ui/flash";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Presupuestos" };
const PAGE = 25;
const SORTS = { recientes: "q.issue_date desc, q.number desc", importe: "q.total_cents desc", validez: "q.valid_until asc", cliente: "c.name asc" } as const;

export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const status = isQuoteStatus(sp.estado) ? sp.estado : sp.estado === "pendientes" ? "pendientes" : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sort = (sp.orden && sp.orden in SORTS ? sp.orden : "recientes") as keyof typeof SORTS;
  const page = Math.max(1, Number(sp.pagina) || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  if (status === "pendientes") where.push(`q.status in ('borrador','revisado','enviado')`);
  else if (status) { params.push(status); where.push(`q.status = $${params.length}`); }
  if (q) { params.push(`%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`); where.push(`(q.code ilike $${params.length} or c.name ilike $${params.length} or q.title ilike $${params.length})`); }
  const w = where.length ? `where ${where.join(" and ")}` : "";

  const { rows, total, summary } = await tenant(s, async (tx) => ({
    rows: await tx.query<{ id: string; code: string; title: string; status: QuoteStatus; issue_date: string; valid_until: string; total_cents: string; subtotal_cents: string; contact_name: string; contact_id: string; sent_at: string | null }>(
      `select q.id, q.code, q.title, q.status, to_char(q.issue_date,'YYYY-MM-DD') as issue_date, to_char(q.valid_until,'YYYY-MM-DD') as valid_until,
              q.total_cents, q.subtotal_cents, c.name as contact_name, c.id as contact_id, q.sent_at
         from quotes q join contacts c on c.id = q.contact_id ${w} order by ${SORTS[sort]} limit ${PAGE} offset ${(page - 1) * PAGE}`, params),
    total: (await tx.one<{ n: number }>(`select count(*)::int as n from quotes q join contacts c on c.id = q.contact_id ${w}`, params))?.n ?? 0,
    summary: await tx.query<{ status: QuoteStatus; n: number; sum: string }>(`select status, count(*)::int as n, coalesce(sum(subtotal_cents),0) as sum from quotes group by status`),
  }));
  const by = Object.fromEntries(summary.map((r) => [r.status, r]));
  const today = todayMadrid();
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | number> = { estado: status, q, orden: sort === "recientes" ? "" : sort, pagina: "" };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v !== "" && !(k === "pagina" && String(v) === "1")) p.set(k, String(v));
    return `/presupuestos${p.toString() ? `?${p}` : ""}`;
  };

  const tiles: { key: string; label: string; n: number; sum: number; tint: string }[] = [
    { key: "borrador", label: "Por revisar", n: (by.borrador?.n ?? 0), sum: Number(by.borrador?.sum ?? 0), tint: "tint-blanca" },
    { key: "revisado", label: "Listos para enviar", n: by.revisado?.n ?? 0, sum: Number(by.revisado?.sum ?? 0), tint: "tint-azul" },
    { key: "enviado", label: "Esperando respuesta", n: by.enviado?.n ?? 0, sum: Number(by.enviado?.sum ?? 0), tint: "tint-rosa" },
    { key: "aceptado", label: "Aceptados", n: by.aceptado?.n ?? 0, sum: Number(by.aceptado?.sum ?? 0), tint: "tint-verde" },
  ];

  return (
    <>
      <PageHeader title="Presupuestos" description="Borradores, revisión, envío y respuesta del cliente. Importes sin IVA en el resumen."
        actions={can(s.user.role, "quotes.write") && <ButtonLink href="/presupuestos/nuevo" variant="primary"><Plus className="size-4" strokeWidth={2} aria-hidden />Nuevo presupuesto</ButtonLink>} />
      <Flash code={sp.aviso} />

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-rule shadow-sheet ring-1 ring-rule lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.key} href={qs({ estado: status === t.key ? "" : t.key, pagina: "" })} aria-current={status === t.key ? "true" : undefined}
            className={cn("bg-sheet px-4 py-3.5 transition-colors hover:bg-paper", status === t.key && "shadow-[inset_0_-3px_0_var(--brand)]")}>
            <span className={cn(t.tint, "tint-chip inline-block size-2.5 rounded-full")} aria-hidden />
            <p className="mt-1.5 text-[0.82rem] text-muted">{t.label}</p>
            <p className="num mt-0.5 text-lg font-semibold">{t.n} <span className="text-[0.85rem] font-normal text-muted">· {formatCents(t.sum, { compact: true })}</span></p>
          </Link>
        ))}
      </div>

      <Sheet>
        <AutoSubmitForm className="grid-cols-1 grid gap-2 border-b border-rule p-3 md:grid-cols-[minmax(14rem,1fr)_14rem_12rem_auto] md:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} aria-hidden />
            <label htmlFor="q" className="sr-only">Buscar</label>
            <Input id="q" name="q" type="search" defaultValue={q} placeholder="Número, cliente o título" className="pl-9" />
          </div>
          <label htmlFor="estado" className="sr-only">Estado</label>
          <Select id="estado" name="estado" defaultValue={status}>
            <option value="">Todos los estados</option>
            <option value="pendientes">Abiertos (sin decisión)</option>
            {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <label htmlFor="orden" className="sr-only">Orden</label>
          <Select id="orden" name="orden" defaultValue={sort}>
            <option value="recientes">Más recientes</option><option value="importe">Mayor importe</option><option value="validez">Validez más próxima</option><option value="cliente">Cliente (A–Z)</option>
          </Select>
          <button type="submit" className={buttonClass("secondary")}>Buscar</button>
        </AutoSubmitForm>
        {rows.length === 0 ? (
          <EmptyState title={q || status ? "Ningún presupuesto coincide" : "Aún no hay presupuestos"}
            action={can(s.user.role, "quotes.write") && !q && !status ? <ButtonLink href="/presupuestos/nuevo" variant="primary">Crear presupuesto</ButtonLink> : undefined}>
            {q || status ? "Cambia la búsqueda o el estado." : "Los presupuestos se crean desde la ficha de un contacto o desde aquí."}
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <caption className="sr-only">Presupuestos</caption>
                <thead>
                  <tr className="border-b border-rule text-left text-[0.78rem] text-muted">
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Número</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Cliente</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Fecha</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Validez</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">Total (IVA incl.)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const expired = r.status === "enviado" && r.valid_until < today;
                    return (
                      <tr key={r.id} className="relative border-b border-rule last:border-0 hover:bg-[color-mix(in_oklab,var(--brand)_4%,white)]">
                        <td className="py-3 pr-3 pl-5"><Link href={`/presupuestos/${r.id}`} className="folio text-[0.95rem] after:absolute after:inset-0">{r.code}</Link></td>
                        <td className="max-w-[22rem] px-3 py-3"><p className="truncate font-medium">{r.contact_name}</p><p className="truncate text-[0.8rem] text-muted">{r.title}</p></td>
                        <td className="px-3 py-3"><QuoteStatusChip status={r.status} /></td>
                        <td className="px-3 py-3 text-ink-2">{fmtDate(r.issue_date + "T12:00:00Z")}</td>
                        <td className={cn("px-3 py-3", expired ? "font-medium text-danger" : "text-ink-2")}>{expired ? "Vencido · " : ""}{fmtDate(r.valid_until + "T12:00:00Z")}</td>
                        <td className="num py-3 pr-5 pl-3 text-right font-medium">{formatCents(r.total_cents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE} total={total} hrefFor={(p) => qs({ pagina: p })} />
          </>
        )}
      </Sheet>
    </>
  );
}
