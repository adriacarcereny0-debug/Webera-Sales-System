import Link from "next/link";
import { CalendarClock, Check, MapPin, Trash2 } from "lucide-react";
import { toggleTask, deleteTask } from "@/app/(app)/agenda/actions";
import { fmtShortDay, fmtTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

export interface TaskItem {
  id: string; kind: "tarea" | "visita"; title: string; due_at: string; ends_at: string | null; location: string | null;
  done_at: string | null; contact_id: string | null; contact_name: string | null; assignee_name: string | null; source: string;
}

export function TaskList({ tasks, showContact = true, canWrite, now = new Date() }: { tasks: TaskItem[]; showContact?: boolean; canWrite: boolean; now?: Date }) {
  return (
    <ul className="divide-y divide-rule">
      {tasks.map((t) => {
        const overdue = !t.done_at && new Date(t.due_at) < now;
        return (
          <li key={t.id} className="flex items-start gap-3 px-4 py-3 md:px-5">
            {canWrite ? (
              <form action={toggleTask}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" aria-label={t.done_at ? `Marcar «${t.title}» como pendiente` : `Completar «${t.title}»`}
                  className={cn("mt-0.5 flex size-6 items-center justify-center rounded-[5px] ring-1 ring-inset transition-colors md:size-5",
                    t.done_at ? "bg-ok text-white ring-ok" : "bg-sheet ring-rule-strong hover:ring-brand")}>
                  {t.done_at && <Check className="size-3.5" strokeWidth={2.5} aria-hidden />}
                </button>
              </form>
            ) : <span className="mt-0.5 size-5" />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-[0.9rem] text-ink", t.done_at && "text-muted line-through decoration-faint")}>
                {t.kind === "visita" && <span className="tint-azul tint-chip mr-2 inline-flex h-5 items-center rounded-[4px] px-1.5 align-[1px] text-[0.7rem] font-semibold">VISITA</span>}
                {t.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8rem] text-muted">
                <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger")}>
                  <CalendarClock className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {overdue && "Vencida · "}{fmtShortDay(t.due_at)} · {fmtTime(t.due_at)}{t.ends_at ? `–${fmtTime(t.ends_at)}` : ""}
                </span>
                {t.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />{t.location}</span>}
                {showContact && t.contact_id && <Link href={`/contactos/${t.contact_id}`} className="text-brand hover:underline">{t.contact_name}</Link>}
                {t.assignee_name && <span>{t.assignee_name}</span>}
                {t.source === "automatizacion" && <span className="text-faint">Creada por automatización</span>}
              </p>
            </div>
            {canWrite && (
              <form action={deleteTask}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" aria-label={`Eliminar «${t.title}»`} className="flex size-9 items-center justify-center rounded-md text-faint hover:bg-paper hover:text-danger md:size-8">
                  <Trash2 className="size-4" strokeWidth={1.6} />
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export const TASK_SELECT = `
  select t.id, t.kind, t.title, t.due_at, t.ends_at, t.location, t.done_at, t.contact_id, t.source,
         c.name as contact_name, u.name as assignee_name
    from tasks t
    left join contacts c on c.id = t.contact_id
    left join users u on u.id = t.assigned_to`;
