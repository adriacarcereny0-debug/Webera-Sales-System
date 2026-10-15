"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCapability, tenant } from "@/lib/auth/session";
import { contactSchema } from "@/lib/validation";
import { readCustomValues } from "@/lib/custom-fields";
import { formValues, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { changeStage, findDuplicates, logActivity } from "@/server/contacts";
import { getCompany } from "@/server/company";
import { audit } from "@/lib/audit";
import { isStage, STAGE_META } from "@/lib/stages";
import { padFolio } from "@/lib/brand";

export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("crm.write");
  const id = String(fd.get("id") ?? "") || null;
  const values = formValues(fd);
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: zodFieldErrors(parsed.error.issues), values };
  const d = parsed.data;

  const result = await tenant(s, async (tx) => {
    const company = await getCompany(tx);
    const cv = readCustomValues(company.custom_fields, fd);
    if (Object.keys(cv.errors).length) return { error: "Revisa los campos marcados.", fieldErrors: cv.errors, values } satisfies ActionState;

    if (fd.get("confirm_duplicate") !== "1") {
      const dups = await findDuplicates(tx, d.email, d.phone, id ?? undefined);
      if (dups.length) {
        return {
          error: `Ya existe un contacto con ese teléfono o email: ${dups.map((x) => `Nº ${padFolio(x.folio)} ${x.name}`).join(", ")}. Si es otra persona, vuelve a guardar para confirmar.`,
          values: { ...values, confirm_duplicate: "1" },
        } satisfies ActionState;
      }
    }

    // Validar que el responsable y el servicio pertenecen a esta empresa (RLS ya lo garantiza al leer).
    if (d.owner_id && !(await tx.one(`select 1 from users where id = $1 and active`, [d.owner_id]))) {
      return { error: "El responsable elegido no existe.", values } satisfies ActionState;
    }
    if (d.service_id && !(await tx.one(`select 1 from services where id = $1`, [d.service_id]))) {
      return { error: "El tipo de instalación elegido no existe.", values } satisfies ActionState;
    }

    const params = [
      d.name, d.company_name, d.phone, d.email, d.address, d.city, d.postal_code, d.service_id, d.source, d.owner_id,
      d.estimated_amount, d.next_action, d.next_action_at, d.timeframe, d.description, JSON.stringify(cv.values),
    ];
    if (id) {
      const row = await tx.one<{ id: string }>(
        `update contacts set name=$1, company_name=$2, phone=$3, email=$4, address=$5, city=$6, postal_code=$7, service_id=$8,
           source=$9, owner_id=$10, estimated_amount_cents=$11, next_action=$12, next_action_at=$13, timeframe=$14,
           description=$15, custom_values=$16 where id = $17 returning id`,
        [...params, id],
      );
      if (!row) return { error: "El contacto no existe o no tienes acceso." } satisfies ActionState;
      return { ok: true, id: row.id };
    }
    const stage = d.stage ?? "nuevo";
    const row = await tx.one<{ id: string }>(
      `insert into contacts(company_id, name, company_name, phone, email, address, city, postal_code, service_id, source, owner_id,
         estimated_amount_cents, next_action, next_action_at, timeframe, description, custom_values, stage, created_by)
       values (app_company_id(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning id`,
      [...params, stage, s.user.id],
    );
    await tx.query(`insert into stage_history(company_id, contact_id, from_stage, to_stage, user_id) values (app_company_id(), $1, null, $2, $3)`, [row!.id, stage, s.user.id]);
    await logActivity(tx, { contactId: row!.id, userId: s.user.id, type: "sistema", body: "Contacto creado." });
    return { ok: true, id: row!.id };
  });

  if ("error" in result) return result;
  revalidatePath("/contactos");
  revalidatePath("/panel");
  redirect(`/contactos/${result.id}?aviso=${id ? "guardado" : "creado"}`);
}

const stageForm = z.object({
  id: z.string().uuid(),
  stage: z.string().refine(isStage, "Fase no válida"),
  note: z.string().trim().max(500).optional(),
  lost_reason: z.string().trim().max(300).optional(),
});

export async function moveStage(_: ActionState | undefined, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("crm.write");
  const parsed = stageForm.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const { id, stage, note, lost_reason } = parsed.data;
  if (stage === "perdido" && !lost_reason) return { error: "Indica el motivo por el que se pierde la oportunidad." };
  const changed = await tenant(s, async (tx) => {
    const ok = await changeStage(tx, id, stage as never, s.user.id, note || null, lost_reason || null);
    if (ok) await logActivity(tx, { contactId: id, userId: s.user.id, type: "cambio_fase", body: note || null, meta: { to: stage } });
    return ok;
  });
  revalidatePath(`/contactos/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/panel");
  return changed ? { ok: true, message: `Movido a «${STAGE_META[stage as keyof typeof STAGE_META].label}».` } : { ok: true, message: "Sin cambios." };
}

/** Variante para formularios simples (pipeline): sin estado de retorno. */
export async function moveStageForm(fd: FormData) {
  await moveStage(undefined, fd);
}

const noteForm = z.object({
  contact_id: z.string().uuid(),
  type: z.enum(["nota", "llamada", "email", "whatsapp", "visita"]),
  body: z.string().trim().min(1, "Escribe la nota.").max(4000),
});

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("crm.write");
  const parsed = noteForm.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: formValues(fd) };
  await tenant(s, async (tx) => {
    const c = await tx.one(`select 1 from contacts where id = $1`, [parsed.data.contact_id]);
    if (!c) throw new Error("Contacto no encontrado");
    await logActivity(tx, { contactId: parsed.data.contact_id, userId: s.user.id, type: parsed.data.type, body: parsed.data.body });
  });
  revalidatePath(`/contactos/${parsed.data.contact_id}`);
  return { ok: true, message: "Anotado en el historial." };
}

const nextForm = z.object({
  id: z.string().uuid(),
  next_action: z.string().trim().max(200).optional(),
  next_action_at: z.string().optional(),
});

export async function setNextAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireCapability("crm.write");
  const parsed = nextForm.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Datos no válidos." };
  const { madridLocalToDate } = await import("@/lib/dates");
  const at = parsed.data.next_action_at ? madridLocalToDate(parsed.data.next_action_at) : null;
  if (parsed.data.next_action_at && !at) return { error: "Fecha no válida." };
  await tenant(s, (tx) =>
    tx.query(`update contacts set next_action = $2, next_action_at = $3 where id = $1`, [parsed.data.id, parsed.data.next_action || null, at]),
  );
  revalidatePath(`/contactos/${parsed.data.id}`);
  return { ok: true, message: "Próxima acción actualizada." };
}

export async function deleteContact(fd: FormData) {
  const s = await requireCapability("settings.manage");
  const id = z.string().uuid().parse(fd.get("id"));
  await tenant(s, async (tx) => {
    const c = await tx.one<{ folio: string; name: string }>(`select folio, name from contacts where id = $1`, [id]);
    if (!c) return;
    await tx.query(`delete from quotes where contact_id = $1`, [id]);
    await tx.query(`delete from contacts where id = $1`, [id]);
    await audit(tx, s, "contacto.eliminar", "contact", id, { folio: c.folio, name: c.name });
  });
  revalidatePath("/contactos");
  redirect("/contactos?aviso=eliminado");
}
