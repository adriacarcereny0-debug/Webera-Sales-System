import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listUsers } from "@/server/contacts";
import { addDaysIso, dateToMadridLocal, fmtWeekday, madridLocalToDate, todayMadrid } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, EmptyState } from "@/components/ui/misc";
import { TaskList, TASK_SELECT, type TaskItem } from "@/components/task-list";
import { padFolio } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { TaskForm } from "./task-form";

export const metadata: Metadata = { title: "Agenda y tareas" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ ver?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const mine = sp.ver !== "todas";
  const onlyVisits = sp.tipo === "visitas";
  const { pending, done, users, contacts } = await tenant(s, async (tx) => {
    const filters = `${mine ? "and t.assigned_to = $1" : "and ($1::uuid is not null)"} ${onlyVisits ? "and t.kind = 'visita'" : ""}`;
    return {
      pending: await tx.query<TaskItem>(`${TASK_SELECT} where t.done_at is null ${filters} order by t.due_at limit 300`, [s.user.id]),
      done: await tx.query<TaskItem>(`${TASK_SELECT} where t.done_at > now() - interval '7 days' ${filters} order by t.done_at desc limit 30`, [s.user.id]),
      users: await listUsers(tx),
      contacts: (await tx.query<{ id: string; folio: string; name: string }>(
        `select id, folio, name from contacts where stage not in ('ganado','perdido') order by name limit 500`)).map((c) => ({ id: c.id, label: `${c.name} · Nº ${padFolio(c.folio)}` })),
    };
  });

  const now = new Date();
  const today = todayMadrid(now);
  const startToday = madridLocalToDate(today)!;
  const startTomorrow = madridLocalToDate(addDaysIso(today, 1))!;
  const startWeek = madridLocalToDate(addDaysIso(today, 8))!;
  const groups: { key: string; title: string; items: TaskItem[]; tone?: string }[] = [
    { key: "vencidas", title: "Vencidas", items: pending.filter((t) => new Date(t.due_at) < startToday), tone: "text-danger" },
    { key: "hoy", title: `Hoy, ${fmtWeekday(now)}`, items: pending.filter((t) => new Date(t.due_at) >= startToday && new Date(t.due_at) < startTomorrow) },
    { key: "semana", title: "Próximos 7 días", items: pending.filter((t) => new Date(t.due_at) >= startTomorrow && new Date(t.due_at) < startWeek) },
    { key: "despues", title: "Más adelante", items: pending.filter((t) => new Date(t.due_at) >= startWeek) },
  ];
  const canWrite = can(s.user.role, "tasks.write");
  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("inline-flex h-9 items-center rounded-md px-3 text-[0.86rem]", active ? "bg-sheet font-semibold text-ink shadow-sheet ring-1 ring-rule" : "text-muted hover:text-ink")}>{label}</Link>
  );
  const q = (ver: string, tipo: string) => `/agenda?${new URLSearchParams({ ...(ver === "todas" ? { ver } : {}), ...(tipo ? { tipo } : {}) })}`;

  return (
    <>
      <PageHeader title="Agenda y tareas" description="Visitas técnicas, llamadas y recordatorios. Lo vencido primero." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-lg bg-[color-mix(in_oklab,var(--paper)_60%,var(--rule))] p-1">
          {tab("Mis tareas", q("mias", onlyVisits ? "visitas" : ""), mine)}
          {tab("De todo el equipo", q("todas", onlyVisits ? "visitas" : ""), !mine)}
        </div>
        <div className="flex rounded-lg bg-[color-mix(in_oklab,var(--paper)_60%,var(--rule))] p-1">
          {tab("Todo", q(mine ? "mias" : "todas", ""), !onlyVisits)}
          {tab("Solo visitas", q(mine ? "mias" : "todas", "visitas"), onlyVisits)}
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {pending.length === 0 ? (
            <Sheet><EmptyState title="Nada pendiente">{mine ? "No tienes tareas ni visitas pendientes." : "El equipo no tiene tareas pendientes."} Crea una desde el formulario o desde la ficha de un contacto.</EmptyState></Sheet>
          ) : groups.filter((g) => g.items.length).map((g) => (
            <Sheet key={g.key}>
              <SheetHeader title={<span className={g.tone}>{g.title} <span className="num ml-1 font-normal text-muted">{g.items.length}</span></span>} />
              <TaskList tasks={g.items} canWrite={canWrite} now={now} />
            </Sheet>
          ))}
          {done.length > 0 && (
            <details className="group rounded-lg bg-sheet shadow-sheet ring-1 ring-rule">
              <summary className="cursor-pointer list-none px-5 py-3 text-[0.9rem] font-semibold">Completadas en los últimos 7 días <span className="num font-normal text-muted">{done.length}</span></summary>
              <div className="border-t border-rule"><TaskList tasks={done} canWrite={canWrite} now={now} /></div>
            </details>
          )}
        </div>
        {canWrite && (
          <Sheet className="xl:sticky xl:top-6">
            <SheetHeader title="Nueva tarea o visita" />
            <div className="p-4">
              <TaskForm users={users} contacts={contacts} defaultAssignee={s.user.id} defaultDue={dateToMadridLocal(new Date(now.getTime() + 86400_000)).slice(0, 10) + "T10:00"} />
            </div>
          </Sheet>
        )}
      </div>
    </>
  );
}
