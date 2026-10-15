"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, tenant } from "@/lib/auth/session";
import { taskSchema } from "@/lib/validation";
import { formValues, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/server/contacts";
import { fmtDateTime } from "@/lib/dates";

function refresh(contactId?: string | null) {
  revalidatePath("/agenda");
  revalidatePath("/panel");
  if (contactId) revalidatePath(`/contactos/${contactId}`);
}

export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("tasks.write");
  const parsed = taskSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues), values: formValues(fd) };
  const t = parsed.data;
  const ends = t.kind === "visita" && t.duration_min ? new Date(t.due_at!.getTime() + t.duration_min * 60_000) : null;
  const err = await tenant(s, async (tx) => {
    if (t.contact_id && !(await tx.one(`select 1 from contacts where id = $1`, [t.contact_id]))) return "El contacto no existe.";
    if (t.assigned_to && !(await tx.one(`select 1 from users where id = $1 and active`, [t.assigned_to]))) return "La persona asignada no existe.";
    await tx.query(
      `insert into tasks(company_id, kind, title, notes, due_at, ends_at, location, contact_id, assigned_to, created_by)
       values (app_company_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t.kind, t.title, t.notes, t.due_at, ends, t.location, t.contact_id, t.assigned_to ?? s.user.id, s.user.id],
    );
    if (t.contact_id) {
      await logActivity(tx, {
        contactId: t.contact_id, userId: s.user.id, type: "tarea",
        body: `${t.kind === "visita" ? "Visita programada" : "Tarea creada"}: ${t.title} · ${fmtDateTime(t.due_at)}`,
      });
      // Si se programa una visita, la próxima acción del contacto pasa a ser esa visita.
      if (t.kind === "visita") {
        await tx.query(`update contacts set next_action = $2, next_action_at = $3 where id = $1`, [t.contact_id, t.title, t.due_at]);
      }
    }
    return null;
  });
  if (err) return { error: err, values: formValues(fd) };
  refresh(t.contact_id);
  return { ok: true, message: t.kind === "visita" ? "Visita programada." : "Tarea creada." };
}

const idForm = z.object({ id: z.string().uuid() });

export async function toggleTask(fd: FormData) {
  const s = await requireCapability("tasks.write");
  const { id } = idForm.parse(Object.fromEntries(fd));
  const contactId = await tenant(s, async (tx) => {
    const t = await tx.one<{ contact_id: string | null; done_at: string | null; title: string }>(
      `update tasks set done_at = case when done_at is null then now() else null end where id = $1 returning contact_id, done_at, title`, [id]);
    if (t?.contact_id && t.done_at) {
      await logActivity(tx, { contactId: t.contact_id, userId: s.user.id, type: "tarea", body: `Completada: ${t.title}` });
    }
    return t?.contact_id ?? null;
  });
  refresh(contactId);
}

export async function deleteTask(fd: FormData) {
  const s = await requireCapability("tasks.write");
  const { id } = idForm.parse(Object.fromEntries(fd));
  const contactId = await tenant(s, async (tx) => (await tx.one<{ contact_id: string | null }>(`delete from tasks where id = $1 returning contact_id`, [id]))?.contact_id ?? null);
  refresh(contactId);
}
