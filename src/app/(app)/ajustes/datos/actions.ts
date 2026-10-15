"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCapability, tenant } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { decodeCsvBytes, mapHeaders, parseCsv } from "@/lib/csv";
import { contactSchema } from "@/lib/validation";
import { madridLocalToDate } from "@/lib/dates";
import { clearCompanyData, clearDemoRecords, seedDemoData } from "@/lib/demo/seed";
import type { Q } from "@/lib/company-defaults";
import type { Tx } from "@/lib/db";

export interface ImportRow {
  line: number; name: string; company_name: string | null; phone: string | null; email: string | null; address: string | null;
  city: string | null; postal_code: string | null; service_id: string | null; service_label: string | null; estimated_amount: number | null;
  description: string | null; created_at: string | null;
}
export interface ImportState {
  error?: string; ok?: boolean; message?: string;
  preview?: { total: number; valid: ImportRow[]; invalid: { line: number; reason: string }[]; duplicates: { line: number; reason: string }[]; unmapped: string[]; mapped: string[] };
}

const MAX_ROWS = 2000;

function parseSpanishDate(v: string): Date | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v.trim());
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return madridLocalToDate(`${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T10:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return madridLocalToDate(v.slice(0, 10) + "T10:00");
  return null;
}

async function analyse(tx: Tx, rows: string[][]) {
  const [header, ...data] = rows;
  const map = mapHeaders(header);
  const mapped = Object.keys(map);
  const unmapped = header.filter((_, i) => !Object.values(map).includes(i)).filter((h) => h.trim());
  const services = await tx.query<{ id: string; name: string }>(`select id, name from services`);
  const svcBy = new Map(services.map((s) => [s.name.toLowerCase(), s.id]));
  const existing = await tx.query<{ email: string | null; phone: string | null }>(`select lower(email) as email, right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 9) as phone from contacts`);
  const seenEmail = new Set(existing.map((e) => e.email).filter(Boolean) as string[]);
  const seenPhone = new Set(existing.map((e) => e.phone).filter((p) => p && p.length === 9) as string[]);

  const valid: ImportRow[] = [];
  const invalid: { line: number; reason: string }[] = [];
  const duplicates: { line: number; reason: string }[] = [];
  data.forEach((r, idx) => {
    const line = idx + 2;
    const get = (k: string) => (map[k] !== undefined ? (r[map[k]] ?? "").trim() : "");
    const parsed = contactSchema.safeParse({
      name: get("name"), company_name: get("company_name"), phone: get("phone"), email: get("email"), address: get("address"),
      city: get("city"), postal_code: get("postal_code"), source: "importacion", estimated_amount: get("estimated_amount"), description: get("description"),
    });
    if (!parsed.success) { invalid.push({ line, reason: parsed.error.issues.map((i) => i.message).join(" ") }); return; }
    const d = parsed.data;
    const digits = d.phone?.replace(/\D/g, "").slice(-9) ?? "";
    if ((d.email && seenEmail.has(d.email)) || (digits.length === 9 && seenPhone.has(digits))) {
      duplicates.push({ line, reason: `${d.name}: ya existe un contacto con ese ${d.email && seenEmail.has(d.email) ? "email" : "teléfono"}` });
      return;
    }
    if (d.email) seenEmail.add(d.email);
    if (digits.length === 9) seenPhone.add(digits);
    const svcLabel = get("service") || null;
    const created = get("created_at") ? parseSpanishDate(get("created_at")) : null;
    valid.push({
      line, name: d.name, company_name: d.company_name, phone: d.phone, email: d.email, address: d.address, city: d.city, postal_code: d.postal_code,
      service_id: svcLabel ? svcBy.get(svcLabel.toLowerCase()) ?? null : null, service_label: svcLabel, estimated_amount: d.estimated_amount,
      description: [d.description, svcLabel && !svcBy.has(svcLabel.toLowerCase()) ? `Instalación indicada en la importación: ${svcLabel}` : null].filter(Boolean).join("\n") || null,
      created_at: created && created.getTime() < Date.now() ? created.toISOString() : null,
    });
  });
  return { total: data.length, valid, invalid, duplicates, unmapped, mapped };
}

export async function previewImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const s = await requireCapability("data.import");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo CSV." };
  if (file.size > 2 * 1024 * 1024) return { error: "El archivo supera 2 MB. Divídelo en varios." };
  const rows = parseCsv(decodeCsvBytes(new Uint8Array(await file.arrayBuffer())));
  if (rows.length < 2) return { error: "El archivo no tiene filas de datos." };
  if (rows.length - 1 > MAX_ROWS) return { error: `Máximo ${MAX_ROWS} filas por importación.` };
  const preview = await tenant(s, (tx) => analyse(tx, rows));
  if (!preview.mapped.includes("name")) return { error: "No se encuentra la columna «Nombre». Revisa la primera fila (cabeceras)." };
  return { preview };
}

const rowSchema = z.array(z.object({
  line: z.number(), name: z.string().min(1).max(160), company_name: z.string().max(160).nullable(), phone: z.string().max(30).nullable(),
  email: z.string().max(160).nullable(), address: z.string().max(200).nullable(), city: z.string().max(100).nullable(),
  postal_code: z.string().regex(/^\d{5}$/).nullable(), service_id: z.string().uuid().nullable(), service_label: z.string().nullable(),
  estimated_amount: z.number().int().min(0).nullable(), description: z.string().max(4500).nullable(), created_at: z.string().datetime().nullable(),
})).max(MAX_ROWS);

export async function commitImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const s = await requireCapability("data.import");
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return { error: "Datos no válidos." }; }
  const parsed = rowSchema.safeParse(raw);
  if (!parsed.success) return { error: "Los datos de la vista previa no son válidos. Vuelve a cargar el archivo." };
  const count = await tenant(s, async (tx) => {
    let n = 0;
    for (const r of parsed.data) {
      // El servicio debe pertenecer a la empresa (RLS); si no, se descarta.
      const svc = r.service_id && (await tx.one(`select 1 from services where id = $1`, [r.service_id])) ? r.service_id : null;
      const row = await tx.one<{ id: string }>(
        `insert into contacts(company_id, name, company_name, phone, email, address, city, postal_code, service_id, source, estimated_amount_cents,
           description, created_by, created_at, stage_changed_at)
         values (app_company_id(), $1,$2,$3,$4,$5,$6,$7,$8,'importacion',$9,$10,$11, coalesce($12::timestamptz, now()), coalesce($12::timestamptz, now())) returning id`,
        [r.name, r.company_name, r.phone, r.email, r.address, r.city, r.postal_code, svc, r.estimated_amount, r.description, s.user.id, r.created_at]);
      await tx.query(`insert into stage_history(company_id, contact_id, to_stage, user_id) values (app_company_id(), $1, 'nuevo', $2)`, [row!.id, s.user.id]);
      n++;
    }
    await audit(tx, s, "importar", "contact", null, { count: n });
    return n;
  });
  revalidatePath("/contactos");
  return { ok: true, message: `${count} contacto${count === 1 ? "" : "s"} importado${count === 1 ? "" : "s"} en la fase «Nuevo contacto».` };
}

// ---------------------------------------------------------------------------
// Demostración
// ---------------------------------------------------------------------------
function asQ(tx: Tx): Q {
  return { query: (text, params) => tx.query(text, params) };
}

/** Restaura la empresa demo a su estado inicial. Solo funciona en empresas marcadas como demo. */
export async function restoreDemo() {
  const s = await requireCapability("demo.manage");
  await tenant(s, async (tx) => {
    const c = await tx.one<{ is_demo: boolean }>(`select is_demo from companies where id = app_company_id()`);
    if (!c?.is_demo) throw new Error("Esta empresa no es de demostración.");
    const users = await tx.query<{ id: string; role: string }>(`select id, role from users where active order by role = 'propietario' desc, created_at`);
    const owner = users[0]!.id;
    const others = users.filter((u) => u.id !== owner).map((u) => u.id);
    await clearCompanyData(asQ(tx), s.company.id);
    await seedDemoData(asQ(tx), s.company.id, { owner, s1: others[0] ?? owner, s2: others[1] ?? others[0] ?? owner });
    await audit(tx, s, "demo.restaurar", "company", s.company.id);
  });
  revalidatePath("/", "layout");
  redirect("/panel?aviso=restaurada");
}

/** Carga datos de ejemplo marcados como demo en una empresa real (para formación). */
export async function loadSampleData() {
  const s = await requireCapability("demo.manage");
  await tenant(s, async (tx) => {
    const exists = await tx.one(`select 1 from contacts where is_demo limit 1`);
    if (exists) return;
    await seedDemoData(asQ(tx), s.company.id, { owner: s.user.id, s1: s.user.id, s2: s.user.id });
    await audit(tx, s, "demo.cargar", "company", s.company.id);
  });
  revalidatePath("/", "layout");
  redirect("/contactos?aviso=importado");
}

export async function deleteSampleData() {
  const s = await requireCapability("demo.manage");
  await tenant(s, async (tx) => {
    await clearDemoRecords(asQ(tx), s.company.id);
    await audit(tx, s, "demo.eliminar", "company", s.company.id);
  });
  revalidatePath("/", "layout");
  redirect("/ajustes/datos?aviso=eliminado");
}
