import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, FilePlus2, UserPlus } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { dashboardData } from "@/server/dashboard";
import { formatCents } from "@/lib/money";
import { fmtMonth, fmtShortDay, fmtTime, fmtWeekday, madridParts, relative } from "@/lib/dates";
import { SOURCES, STAGE_META, OPEN_STAGES } from "@/lib/stages";
import { Sheet, SheetHeader, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { ColumnChart, BarList } from "@/components/charts/bars";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Panel" };

function greeting(now: Date) {
  const h = madridParts(now).hour;
  return h < 14 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

const ACTIVITY_FALLBACK: Record<string, string> = { cambio_fase: "Cambio de fase", nota: "Nota", llamada: "Llamada", tarea: "Tarea", presupuesto: "Presupuesto", sistema: "Registro" };

const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 100));

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const d = await tenant(s, (tx) => dashboardData(tx, s.user.id));
  const { k } = d;
  const now = new Date();
  const conversion = pct(k.won_180, k.won_180 + k.lost_180);
  const acceptance = pct(k.q_acc_90, k.q_acc_90 + k.q_rej_90);
  const delta = k.leads_30 - k.leads_prev_30;

  const kpis: { label: string; value: string; note: React.ReactNode; href: string }[] = [
    {
      label: "Solicitudes recibidas", value: String(k.leads_30), href: "/contactos?orden=recientes",
      note: <>últimos 30 días · {k.leads_web_30} por la web{k.leads_prev_30 || k.leads_30 ? <> · <span className={delta > 0 ? "text-ok" : delta < 0 ? "text-danger" : ""}>{delta > 0 ? "+" : ""}{delta}</span> vs. 30 días anteriores</> : null}</>,
    },
    { label: "Contactos nuevos sin atender", value: String(k.new_now), href: "/contactos?fase=nuevo", note: k.unassigned ? <span className="text-warn">{k.unassigned} oportunidades sin responsable</span> : "todas tienen responsable" },
    { label: "Presupuestos pendientes", value: String(k.q_draft + k.q_reviewed + k.q_sent), href: "/presupuestos?estado=pendientes",
      note: <>{k.q_sent} enviados ({formatCents(k.q_sent_value, { compact: true })}) · {k.q_draft} por revisar · {k.q_reviewed} por enviar</> },
    { label: "Aceptados / rechazados", value: `${k.q_acc_90} / ${k.q_rej_90}`, href: "/presupuestos?estado=aceptado",
      note: <>últimos 90 días · {formatCents(k.q_acc_value_90, { compact: true })} aceptados{acceptance !== null ? ` · ${acceptance} % de aceptación` : ""}</> },
    { label: "Valor en oportunidades abiertas", value: formatCents(k.open_value, { compact: true }), href: "/pipeline", note: `${k.open_count} oportunidades en curso · sin IVA` },
    { label: "Tasa de conversión", value: conversion === null ? "—" : `${conversion} %`, href: "/contactos?fase=ganado",
      note: conversion === null ? "aún no hay oportunidades cerradas" : `${k.won_180} ganadas de ${k.won_180 + k.lost_180} cerradas en 6 meses` },
  ];

  const attention = [
    { n: k.new_now, label: "contactos nuevos esperando primera llamada", href: "/contactos?fase=nuevo" },
    { n: k.overdue_tasks, label: "tareas o visitas vencidas", href: "/agenda?ver=todas" },
    { n: k.q_draft, label: "presupuestos pendientes de revisión", href: "/presupuestos?estado=borrador" },
    { n: k.q_sent_overdue, label: "presupuestos enviados con la validez vencida", href: "/presupuestos?estado=enviado&orden=validez" },
  ].filter((a) => a.n > 0);

  const stageOrder = Object.fromEntries(OPEN_STAGES.map((s, i) => [s, i]));
  const byStage = [...d.byStage].sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{fmtWeekday(now)}</p>
          <h1 className="mt-1 text-[1.75rem] leading-[1.1] font-semibold tracking-[-0.028em] md:text-[2.25rem]">{greeting(now)}, {s.user.name.split(" ")[0]}</h1>
        </div>
        <nav aria-label="Acciones rápidas" className="flex flex-wrap gap-2">
          {can(s.user.role, "crm.write") && <ButtonLink href="/contactos/nuevo" variant="primary"><UserPlus className="size-4" strokeWidth={1.75} aria-hidden />Nuevo contacto</ButtonLink>}
          {can(s.user.role, "quotes.write") && <ButtonLink href="/presupuestos/nuevo" variant="secondary"><FilePlus2 className="size-4" strokeWidth={1.75} aria-hidden />Presupuesto</ButtonLink>}
          {can(s.user.role, "tasks.write") && <ButtonLink href="/agenda" variant="secondary"><CalendarPlus className="size-4" strokeWidth={1.75} aria-hidden />Tarea o visita</ButtonLink>}
        </nav>
      </header>
      <Flash code={sp.aviso} />

      {/* Indicadores: una tira de talonario con trepado entre casillas */}
      <section aria-label="Indicadores" className="mb-5 overflow-hidden rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
        <ul className="grid-cols-1 -mr-px -mb-px grid sm:grid-cols-2 xl:grid-cols-3">
          {kpis.map((x) => (
            <li key={x.label} className="border-r border-b border-dashed border-rule-strong">
              <Link href={x.href} className="group block h-full px-5 py-4 transition-colors hover:bg-[color-mix(in_oklab,var(--brand)_3.5%,white)]">
                <p className="flex items-center justify-between text-[0.84rem] text-muted">
                  {x.label}
                  <ArrowRight className="size-4 text-faint opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={1.75} aria-hidden />
                </p>
                <p className="num mt-1.5 text-[2rem] leading-none font-semibold tracking-[-0.025em] text-ink">{x.value}</p>
                <p className="mt-2 text-[0.78rem] leading-snug text-muted">{x.note}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {attention.length > 0 && (
        <section aria-label="Requiere atención" className="tint-amarilla mb-5 rounded-lg border border-[var(--t-line)] bg-[var(--t-bg)] px-4 py-3 text-[var(--t-fg)] md:px-5">
          <h2 className="text-[0.86rem] font-semibold">Requiere atención</h2>
          <ul className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[0.88rem]">
            {attention.map((a) => (
              <li key={a.href}><Link href={a.href} className="underline decoration-[var(--t-line)] underline-offset-4 hover:decoration-current"><strong className="num">{a.n}</strong> {a.label}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid-cols-1 mb-5 grid gap-5 lg:grid-cols-2">
        <Sheet>
          <SheetHeader title="Solicitudes por mes" description="Contactos registrados cada mes, de todos los orígenes." />
          <div className="px-4 pt-5 pb-4 md:px-5">
            <ColumnChart title="Solicitudes por mes" data={d.leadsByMonth.map((m) => ({ label: fmtMonth(m.month + "T12:00:00Z"), value: m.n, display: String(m.n), hint: `${m.n} solicitudes` }))} />
          </div>
        </Sheet>
        <Sheet>
          <SheetHeader title="Ventas aceptadas por mes" description="Base imponible de los presupuestos aceptados, por fecha de aceptación." />
          <div className="px-4 pt-5 pb-4 md:px-5">
            <ColumnChart title="Ventas aceptadas por mes (sin IVA)" data={d.wonByMonth.map((m) => ({ label: fmtMonth(m.month + "T12:00:00Z"), value: Number(m.cents), display: formatCents(m.cents, { compact: true }), hint: `${m.n} presupuesto${m.n === 1 ? "" : "s"} · ${formatCents(m.cents, { compact: true })}` }))} />
          </div>
        </Sheet>
      </div>

      <div className="grid-cols-1 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Sheet>
            <SheetHeader title="Próximas visitas y tareas" description="Pendientes de los próximos 7 días, incluidas las vencidas." actions={<Link href="/agenda" className="text-[0.84rem] text-brand hover:underline">Agenda</Link>} />
            {d.agenda.length === 0 ? <EmptyState title="Sin tareas para los próximos días">Programa visitas y recordatorios desde la ficha de cada contacto.</EmptyState> : (
              <ul className="divide-y divide-rule">
                {d.agenda.map((t) => {
                  const overdue = new Date(t.due_at) < now;
                  return (
                    <li key={t.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-3 md:px-5">
                      <div className={cn("text-[0.78rem] leading-tight", overdue ? "font-medium text-danger" : "text-muted")}>
                        <p className="first-letter:uppercase">{overdue ? "Vencida" : fmtShortDay(t.due_at)}</p>
                        <p className="num text-ink-2">{fmtTime(t.due_at)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem]">
                          {t.kind === "visita" && <span className="tint-azul tint-chip mr-2 inline-flex h-5 items-center rounded-[4px] px-1.5 align-[1px] text-[0.68rem] font-semibold">VISITA</span>}
                          {t.title}
                        </p>
                        <p className="truncate text-[0.78rem] text-muted">
                          {t.contact_id ? <Link href={`/contactos/${t.contact_id}`} className="text-brand hover:underline">{t.contact_name}</Link> : "Sin contacto"}
                          {t.location ? ` · ${t.location}` : ""} · {t.mine ? "Tú" : t.assignee ?? "Sin asignar"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Sheet>
          <Sheet>
            <SheetHeader title="Actividad reciente" />
            {d.activity.length === 0 ? <EmptyState title="Todavía no hay actividad" /> : (
              <ol className="divide-y divide-rule">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5 md:px-5">
                    <p className="min-w-0 truncate text-[0.86rem] text-ink-2">
                      {a.contact_id && <Link href={`/contactos/${a.contact_id}`} className="font-medium text-ink hover:underline">{a.contact_name}</Link>}
                      {a.contact_id && " · "}{a.body ?? ACTIVITY_FALLBACK[a.type] ?? a.type}
                    </p>
                    <time className="shrink-0 text-[0.76rem] text-muted" dateTime={a.created_at}>{relative(a.created_at, now)}</time>
                  </li>
                ))}
              </ol>
            )}
          </Sheet>
        </div>
        <div className="space-y-5">
          <Sheet>
            <SheetHeader title="Valor abierto por fase" description="Importe estimado sin IVA." actions={<Link href="/pipeline" className="text-[0.84rem] text-brand hover:underline">Pipeline</Link>} />
            <div className="p-4 md:p-5">
              <BarList title="Valor abierto por fase" data={byStage.map((b) => ({ label: STAGE_META[b.stage].label, value: Number(b.cents), display: Number(b.cents) ? `${formatCents(b.cents, { compact: true })} · ${b.n}` : `Sin importe · ${b.n}`, hint: `${b.n} oportunidades` }))} />
            </div>
          </Sheet>
          <Sheet>
            <SheetHeader title="De dónde llegan" description="Origen de los contactos de los últimos 90 días." />
            <div className="p-4 md:p-5">
              <BarList title="Origen de los contactos" data={d.bySource.map((b) => ({ label: SOURCES[b.source] ?? b.source, value: b.n, display: String(b.n) }))} />
            </div>
          </Sheet>
        </div>
      </div>
    </>
  );
}
