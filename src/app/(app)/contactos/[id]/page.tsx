/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getContact, listUsers } from "@/server/contacts";
import { getCompany } from "@/server/company";
import { SOURCES, STAGE_META, TIMEFRAMES, type QuoteStatus, type Stage } from "@/lib/stages";
import { formatCents } from "@/lib/money";
import { dateToMadridLocal, fmtDate, fmtDateTime, relative } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, Definition, EmptyState } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StageChip, QuoteStatusChip, DemoChip } from "@/components/ui/chip";
import { Folio } from "@/components/ui/folio";
import { Flash } from "@/components/ui/flash";
import { ConfirmAction } from "@/components/ui/confirm";
import { TaskList, TASK_SELECT, type TaskItem } from "@/components/task-list";
import { TaskForm } from "../../agenda/task-form";
import { NextActionForm, NoteComposer, StageControl } from "./client-forms";
import { deleteContact } from "../actions";

export const metadata: Metadata = { title: "Ficha de contacto" };

const ACTIVITY_LABEL: Record<string, string> = {
  nota: "Nota", llamada: "Llamada", email: "Email", whatsapp: "WhatsApp", visita: "Visita", cambio_fase: "Cambio de fase",
  presupuesto: "Presupuesto", tarea: "Tarea", formulario: "Formulario web", automatizacion: "Automatización", sistema: "Sistema",
};

export default async function ContactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireSession();
  const data = await tenant(s, async (tx) => {
    const c = await getContact(tx, id);
    if (!c) return null;
    const activities = await tx.query<{ id: string; type: string; body: string | null; created_at: string; user_name: string | null; meta: Record<string, string> }>(
        `select a.id, a.type, a.body, a.created_at, a.meta, u.name as user_name from activities a left join users u on u.id = a.user_id
          where a.contact_id = $1 order by a.created_at desc limit 100`, [id]);
    const history = await tx.query<{ from_stage: Stage | null; to_stage: Stage; created_at: string; user_name: string | null; note: string | null }>(
        `select h.from_stage, h.to_stage, h.created_at, h.note, u.name as user_name from stage_history h left join users u on u.id = h.user_id
          where h.contact_id = $1 order by h.created_at desc`, [id]);
    const quotes = await tx.query<{ id: string; code: string; title: string; status: QuoteStatus; total_cents: string; subtotal_cents: string; issue_date: string; valid_until: string }>(
        `select id, code, title, status, total_cents, subtotal_cents, issue_date, valid_until from quotes where contact_id = $1 order by created_at desc`, [id]);
    const tasks = await tx.query<TaskItem>(`${TASK_SELECT} where t.contact_id = $1 order by (t.done_at is not null), t.due_at`, [id]);
    const attachments = await tx.query<{ id: string; filename: string; size_bytes: number }>(`select id, filename, size_bytes from attachments where contact_id = $1 order by created_at`, [id]);
    const users = await listUsers(tx);
    const company = await getCompany(tx);
    return { c, activities, history, quotes, tasks, attachments, users, company };
  });
  if (!data) notFound();
  const { c, activities, history, quotes, tasks, attachments, users, company } = data;
  const canCrm = can(s.user.role, "crm.write");
  const canQuote = can(s.user.role, "quotes.write");
  const now = new Date();
  const overdue = c.next_action_at && new Date(c.next_action_at) < now && !["ganado", "perdido"].includes(c.stage);
  const tomorrow10 = (() => {
    const d = new Date(now.getTime() + 86400_000);
    return dateToMadridLocal(d).slice(0, 10) + "T10:00";
  })();

  return (
    <>
      <nav aria-label="Ruta" className="mb-3 text-[0.85rem] text-muted">
        <Link href="/contactos" className="hover:text-ink hover:underline">Contactos</Link>
        <span aria-hidden className="mx-1.5">/</span>
        <span className="text-ink-2">{c.name}</span>
      </nav>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">{c.name}{c.is_demo && !s.company.isDemo && <DemoChip />}</span>}
        description={[c.company_name, c.service_name, c.city].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            {canCrm && <ButtonLink href={`/contactos/${c.id}/editar`} variant="secondary"><Pencil className="size-4" strokeWidth={1.75} aria-hidden />Editar</ButtonLink>}
            {canQuote && <ButtonLink href={`/presupuestos/nuevo?contacto=${c.id}`} variant="primary"><FilePlus2 className="size-4" strokeWidth={1.75} aria-hidden />Nuevo presupuesto</ButtonLink>}
          </>
        }
      />
      <Flash code={sp.aviso} />

      {/* Talonario: matriz | trepado | hoja */}
      <div className="grid-cols-1 grid gap-5 lg:grid-cols-[19rem_2px_minmax(0,1fr)] lg:gap-0">
        {/* MATRIZ */}
        <aside className="space-y-5 lg:pr-6" aria-label="Resumen del contacto">
          <Sheet className="overflow-hidden">
            <div className={`${STAGE_META[c.stage].tint} border-b border-[var(--t-line)] bg-[var(--t-bg)] px-4 py-4`}>
              <div className="flex items-start justify-between gap-3">
                <Folio n={c.folio} className="block text-[1.9rem] leading-none" />
                <StageChip stage={c.stage} />
              </div>
              <p className="mt-3 text-[0.8rem] text-[var(--t-fg)]">Entrada el {fmtDate(c.created_at)} · {SOURCES[c.source]}</p>
            </div>
            <dl className="divide-y divide-rule px-4">
              <Definition term="Importe est.">{c.estimated_amount_cents ? <span className="num font-semibold">{formatCents(c.estimated_amount_cents)}</span> : null}</Definition>
              <Definition term="Responsable">{c.owner_name ?? <span className="text-warn">Sin asignar</span>}</Definition>
              <Definition term="Plazo">{c.timeframe ? TIMEFRAMES[c.timeframe as keyof typeof TIMEFRAMES] ?? c.timeframe : null}</Definition>
              <Definition term="En esta fase">{relative(c.stage_changed_at, now).replace(/^hace /, "")}</Definition>
              {c.stage === "perdido" && <Definition term="Motivo">{c.lost_reason}</Definition>}
            </dl>
            <div className="space-y-2 border-t border-rule px-4 py-3 text-sm">
              {c.phone && <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-ink hover:text-brand"><Phone className="size-4 text-faint" strokeWidth={1.75} aria-hidden />{c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-2 break-all text-ink hover:text-brand"><Mail className="size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />{c.email}</a>}
              {(c.address || c.city) && (
                <p className="flex items-start gap-2 text-ink-2"><MapPin className="mt-0.5 size-4 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />{[c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
              )}
            </div>
          </Sheet>

          <Sheet>
            <SheetHeader title="Próxima acción" />
            <div className="px-4 py-3.5">
              {c.next_action || c.next_action_at ? (
                <div className={`mb-4 rounded-md px-3 py-2.5 ${overdue ? "tint-rosa tint-chip" : "bg-paper"}`}>
                  <p className="text-sm font-medium">{c.next_action ?? "Acción sin describir"}</p>
                  {c.next_action_at && <p className="mt-0.5 text-[0.8rem]">{overdue ? "Vencida: " : ""}{fmtDateTime(c.next_action_at)}</p>}
                </div>
              ) : !["ganado", "perdido"].includes(c.stage) ? (
                <p className="mb-4 text-[0.85rem] text-warn">Sin próxima acción definida. Una oportunidad sin siguiente paso es la que se olvida.</p>
              ) : null}
              {canCrm && <NextActionForm id={c.id} action={c.next_action ?? ""} at={dateToMadridLocal(c.next_action_at)} />}
            </div>
          </Sheet>

          {canCrm && (
            <Sheet>
              <SheetHeader title="Fase de la oportunidad" />
              <div className="px-4 py-3.5"><StageControl id={c.id} current={c.stage} /></div>
            </Sheet>
          )}

          <Sheet>
            <SheetHeader title="Historial de fases" />
            <ol className="px-4 py-3">
              {history.map((h, i) => (
                <li key={i} className="relative border-l border-rule-strong pb-3 pl-4 last:pb-0">
                  <span className={`${STAGE_META[h.to_stage].tint} tint-chip absolute top-1 -left-[5px] size-[9px] rounded-full`} aria-hidden />
                  <p className="text-[0.85rem] font-medium">{STAGE_META[h.to_stage].label}</p>
                  <p className="text-[0.76rem] text-muted">{fmtDateTime(h.created_at)}{h.user_name ? ` · ${h.user_name}` : ""}</p>
                  {h.note && <p className="mt-0.5 text-[0.8rem] text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Sheet>
        </aside>

        <div className="perforation-y hidden lg:block" aria-hidden />

        {/* HOJA */}
        <div className="min-w-0 space-y-5 lg:pl-6">
          {c.description && (
            <Sheet>
              <SheetHeader title="Proyecto solicitado" />
              <p className="max-w-[70ch] px-4 py-3.5 text-[0.92rem] leading-relaxed whitespace-pre-line text-ink-2 md:px-5">{c.description}</p>
              {attachments.length > 0 && (
                <ul className="flex flex-wrap gap-2 px-4 pb-4 md:px-5" aria-label="Fotografías adjuntas">
                  {attachments.map((a) => (
                    <li key={a.id}>
                      <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-md ring-1 ring-rule hover:ring-brand">
                        <img src={`/api/attachments/${a.id}`} alt={`Foto adjunta: ${a.filename}`} className="size-24 object-cover" loading="lazy" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Sheet>
          )}

          <Sheet>
            <SheetHeader title="Presupuestos" actions={canQuote && quotes.length > 0 ? <ButtonLink href={`/presupuestos/nuevo?contacto=${c.id}`} size="sm" variant="quiet">Nuevo</ButtonLink> : undefined} />
            {quotes.length === 0 ? (
              <EmptyState title="Sin presupuestos" action={canQuote ? <ButtonLink href={`/presupuestos/nuevo?contacto=${c.id}`} variant="secondary">Preparar presupuesto</ButtonLink> : undefined}>
                Crea un borrador con los conceptos de la instalación. Podrás revisarlo antes de enviarlo.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-rule">
                {quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/presupuestos/${q.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper md:px-5">
                      <span className="folio text-[0.95rem]">{q.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{q.title}</span>
                      <QuoteStatusChip status={q.status} />
                      <span className="num w-28 text-right text-sm font-medium">{formatCents(q.total_cents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>

          <Sheet>
            <SheetHeader title="Tareas y visitas" description={tasks.filter((t) => !t.done_at).length ? `${tasks.filter((t) => !t.done_at).length} pendientes` : undefined} />
            <div className="grid-cols-1 grid gap-0 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="min-w-0">
                {tasks.length ? <TaskList tasks={tasks} showContact={false} canWrite={can(s.user.role, "tasks.write")} now={now} /> :
                  <p className="px-4 py-6 text-sm text-muted md:px-5">Sin tareas. Programa la visita técnica o un recordatorio de llamada.</p>}
              </div>
              {can(s.user.role, "tasks.write") && (
                <div className="border-t border-rule p-4 xl:border-t-0 xl:border-l">
                  <TaskForm contactId={c.id} users={users} defaultAssignee={c.owner_id ?? s.user.id} defaultDue={tomorrow10} compact />
                </div>
              )}
            </div>
          </Sheet>

          <Sheet>
            <SheetHeader title="Actividad" description="Notas, llamadas y cambios registrados." />
            {canCrm && <div className="border-b border-rule px-4 py-4 md:px-5"><NoteComposer contactId={c.id} /></div>}
            <ol className="px-4 py-2 md:px-5">
              {activities.map((a) => (
                <li key={a.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-rule py-3 last:border-0 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <div className="text-[0.76rem] text-muted">
                    <p className="font-medium text-ink-2">{ACTIVITY_LABEL[a.type] ?? a.type}</p>
                    <time dateTime={a.created_at}>{fmtDateTime(a.created_at)}</time>
                  </div>
                  <div className="min-w-0 text-[0.88rem]">
                    {a.type === "cambio_fase" && a.meta?.to && <p className="mb-0.5">Movido a <StageChip stage={a.meta.to as Stage} short /></p>}
                    {a.body && <p className="whitespace-pre-line text-ink-2">{a.body}</p>}
                    {a.user_name && <p className="mt-0.5 text-[0.76rem] text-faint">{a.user_name}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Sheet>

          {company.custom_fields.length > 0 && (
            <Sheet>
              <SheetHeader title="Datos adicionales" />
              <dl className="divide-y divide-rule px-4 md:px-5">
                {company.custom_fields.map((f) => {
                  const v = c.custom_values?.[f.key];
                  return <Definition key={f.key} term={f.label}>{v === undefined || v === "" ? null : f.type === "si_no" ? (v ? "Sí" : "No") : String(v)}</Definition>;
                })}
              </dl>
            </Sheet>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-[0.8rem] text-muted">
            <p>{c.consent_at ? `Consentimiento de privacidad registrado el ${fmtDateTime(c.consent_at)}.` : "Alta manual: sin consentimiento web registrado."}</p>
            {can(s.user.role, "settings.manage") && (
              <ConfirmAction label="Eliminar contacto" variant="ghost" size="sm" title={`¿Eliminar a ${c.name}?`} confirmLabel="Eliminar definitivamente"
                action={deleteContact} fields={{ id: c.id }}>
                Se borrarán también sus presupuestos, tareas, notas y fotos. Esta acción no se puede deshacer.
              </ConfirmAction>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
