import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listContacts, listServices, listUsers, SORTS } from "@/server/contacts";
import { OPEN_STAGES, SOURCES, STAGE_META, STAGES, isStage } from "@/lib/stages";
import { formatCents } from "@/lib/money";
import { fmtDate, relative } from "@/lib/dates";
import { PageHeader, Sheet, EmptyState } from "@/components/ui/misc";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { StageChip, DemoChip } from "@/components/ui/chip";
import { Folio } from "@/components/ui/folio";
import { Pagination } from "@/components/ui/pagination";
import { AutoSubmitForm } from "@/components/ui/auto-submit";
import { Flash } from "@/components/ui/flash";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Contactos" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const SORT_LABELS: Record<keyof typeof SORTS, string> = {
  recientes: "Más recientes",
  antiguos: "Más antiguos",
  nombre: "Nombre (A–Z)",
  importe: "Mayor importe",
  proxima: "Próxima acción",
  folio: "Número de folio",
};

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const filters = {
    q: one(sp.q), stage: one(sp.fase), owner: one(sp.responsable), service: one(sp.servicio), source: one(sp.origen),
    sort: one(sp.orden) || "recientes", page: Number(one(sp.pagina)) || 1,
  };
  const { list, users, services, counts } = await tenant(s, async (tx) => ({
    list: await listContacts(tx, filters),
    users: await listUsers(tx),
    services: await listServices(tx, false),
    counts: await tx.query<{ stage: string; n: number }>(`select stage, count(*)::int as n from contacts group by stage`),
  }));
  const countBy = Object.fromEntries(counts.map((c) => [c.stage, c.n]));
  const totalAll = counts.reduce((a, c) => a + c.n, 0);
  const openCount = OPEN_STAGES.reduce((a, st) => a + (countBy[st] ?? 0), 0);

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const base = { q: filters.q, fase: filters.stage, responsable: filters.owner, servicio: filters.service, origen: filters.source, orden: filters.sort === "recientes" ? "" : filters.sort, pagina: "" };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v !== undefined && v !== "" && !(k === "pagina" && String(v) === "1")) p.set(k, String(v));
    const str = p.toString();
    return `/contactos${str ? `?${str}` : ""}`;
  };
  const hasFilters = !!(filters.q || filters.stage || filters.owner || filters.service || filters.source);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="Contactos"
        description="Cada solicitud y cliente con su número, su fase y su próximo paso."
        actions={
          <>
            {can(s.user.role, "data.import") && (
              <ButtonLink href="/ajustes/datos#importar" variant="secondary"><Upload className="size-4" strokeWidth={1.75} aria-hidden />Importar CSV</ButtonLink>
            )}
            {can(s.user.role, "crm.write") && (
              <ButtonLink href="/contactos/nuevo" variant="primary"><Plus className="size-4" strokeWidth={2} aria-hidden />Nuevo contacto</ButtonLink>
            )}
          </>
        }
      />
      <Flash code={sp.aviso} />

      {/* Fases como pestañas del talonario */}
      <nav aria-label="Filtrar por fase" className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1.5">
          {[
            { key: "", label: "Todos", n: totalAll, tint: "" },
            { key: "abiertos", label: "En curso", n: openCount, tint: "" },
            ...STAGES.map((st) => ({ key: st, label: STAGE_META[st].short, n: countBy[st] ?? 0, tint: STAGE_META[st].tint })),
          ].map((t) => {
            const active = filters.stage === t.key;
            return (
              <li key={t.key || "todos"}>
                <Link href={qs({ fase: t.key, pagina: undefined })} aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-[0.85rem] transition-colors",
                    t.tint, t.tint && "tint-chip",
                    !t.tint && "bg-sheet ring-1 ring-inset ring-rule text-ink-2 hover:text-ink",
                    active ? "font-semibold shadow-[inset_0_0_0_2px_var(--brand)]" : "hover:brightness-[0.97]",
                  )}>
                  {t.label}
                  <span className="num text-[0.78rem] opacity-70">{t.n}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Sheet>
        <AutoSubmitForm className="grid-cols-1 grid gap-2 border-b border-rule p-3 md:grid-cols-[minmax(14rem,1.6fr)_repeat(4,minmax(0,1fr))_auto] md:p-4">
          {filters.stage && <input type="hidden" name="fase" value={filters.stage} />}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} aria-hidden />
            <label htmlFor="q" className="sr-only">Buscar</label>
            <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Nombre, teléfono, email, localidad o Nº" className="pl-9" />
          </div>
          <label className="sr-only" htmlFor="responsable">Responsable</label>
          <Select id="responsable" name="responsable" defaultValue={filters.owner}>
            <option value="">Todos los responsables</option>
            <option value="sin">Sin responsable</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <label className="sr-only" htmlFor="servicio">Instalación</label>
          <Select id="servicio" name="servicio" defaultValue={filters.service}>
            <option value="">Todas las instalaciones</option>
            {services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
          <label className="sr-only" htmlFor="origen">Origen</label>
          <Select id="origen" name="origen" defaultValue={filters.source}>
            <option value="">Todos los orígenes</option>
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <label className="sr-only" htmlFor="orden">Ordenar por</label>
          <Select id="orden" name="orden" defaultValue={filters.sort}>
            {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <div className="flex gap-2">
            <button type="submit" className={buttonClass("secondary", "md", "flex-1 md:flex-none")}>Buscar</button>
            {hasFilters && <Link href="/contactos" className={buttonClass("ghost", "md")}>Limpiar</Link>}
          </div>
        </AutoSubmitForm>

        {list.rows.length === 0 ? (
          hasFilters ? (
            <EmptyState title="Ningún contacto coincide con estos filtros" action={<ButtonLink href="/contactos" variant="secondary">Quitar filtros</ButtonLink>}>
              Prueba con otra búsqueda o revisa la fase seleccionada.
            </EmptyState>
          ) : (
            <EmptyState title="Todavía no hay contactos"
              action={can(s.user.role, "crm.write") ? <ButtonLink href="/contactos/nuevo" variant="primary">Crear el primero</ButtonLink> : undefined}>
              Los contactos llegan desde el formulario de tu web, o puedes darlos de alta a mano o importarlos desde un CSV.
            </EmptyState>
          )
        ) : (
          <>
            {/* Tabla en escritorio */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <caption className="sr-only">Listado de contactos</caption>
                <thead>
                  <tr className="border-b border-rule text-left text-[0.78rem] text-muted">
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Nº</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Contacto</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Instalación</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Fase</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Responsable</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Importe est.</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Próxima acción</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">Entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map((c) => {
                    const overdue = c.next_action_at && new Date(c.next_action_at) < now && c.stage !== "ganado" && c.stage !== "perdido";
                    return (
                      <tr key={c.id} className="group relative border-b border-rule last:border-0 hover:bg-[color-mix(in_oklab,var(--brand)_4%,white)]">
                        <td className="py-3 pr-3 pl-5 align-top"><Folio n={c.folio} className="text-[0.95rem]" /></td>
                        <td className="max-w-[18rem] px-3 py-3 align-top">
                          <Link href={`/contactos/${c.id}`} className="font-medium text-ink after:absolute after:inset-0 hover:underline">{c.name}</Link>
                          <p className="truncate text-[0.8rem] text-muted">{[c.company_name, c.city].filter(Boolean).join(" · ") || c.phone || c.email}</p>
                        </td>
                        <td className="px-3 py-3 align-top text-ink-2">{c.service_name ?? <span className="text-faint">—</span>}</td>
                        <td className="px-3 py-3 align-top"><span className="inline-flex gap-1.5"><StageChip stage={c.stage} short />{c.is_demo && !s.company.isDemo && <DemoChip />}</span></td>
                        <td className="px-3 py-3 align-top text-ink-2">{c.owner_name ?? <span className="text-[0.8rem] text-warn">Sin asignar</span>}</td>
                        <td className="num px-3 py-3 text-right align-top">{c.estimated_amount_cents ? formatCents(c.estimated_amount_cents, { compact: true }) : <span className="text-faint">—</span>}</td>
                        <td className="max-w-[15rem] px-3 py-3 align-top">
                          {c.next_action || c.next_action_at ? (
                            <>
                              <p className="truncate text-ink-2">{c.next_action ?? "Sin descripción"}</p>
                              {c.next_action_at && <p className={cn("text-[0.8rem]", overdue ? "font-medium text-danger" : "text-muted")}>{overdue ? "Vencida · " : ""}{fmtDate(c.next_action_at)}</p>}
                            </>
                          ) : c.stage === "ganado" || c.stage === "perdido" ? <span className="text-faint">—</span> : <span className="text-[0.8rem] text-warn">Sin definir</span>}
                        </td>
                        <td className="py-3 pr-5 pl-3 align-top text-[0.8rem] whitespace-nowrap text-muted" title={fmtDate(c.created_at)}>{relative(c.created_at, now)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista en móvil y tablet */}
            <ul className="divide-y divide-rule lg:hidden">
              {list.rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/contactos/${c.id}`} className="block px-4 py-3.5 hover:bg-paper">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="truncate text-[0.82rem] text-muted">{[c.service_name, c.city].filter(Boolean).join(" · ")}</p>
                      </div>
                      <Folio n={c.folio} className="shrink-0 text-[0.9rem]" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.8rem] text-muted">
                      <StageChip stage={c.stage} short />
                      {c.estimated_amount_cents && <span className="num">{formatCents(c.estimated_amount_cents, { compact: true })}</span>}
                      {c.next_action_at && <span>· {c.next_action ?? "Acción"} {fmtDate(c.next_action_at)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(p) => qs({ pagina: p })} />
          </>
        )}
      </Sheet>
      {isStage(filters.stage) && <p className="mt-3 text-[0.82rem] text-muted">{STAGE_META[filters.stage].hint}</p>}
    </>
  );
}
