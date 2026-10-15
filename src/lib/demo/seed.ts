/**
 * Datos de demostración. TODOS los registros se crean con is_demo = true y son
 * ficticios: nombres, teléfonos (rango 600 000 xxx), emails (dominio .example)
 * e importes de ejemplo. Los precios NO son tarifas reales de ningún instalador.
 */
import { computeQuote } from "../quotes/calc";
import type { Q } from "../company-defaults";

type Row = Record<string, unknown>;
async function one<T = Row>(tx: Q, sql: string, params: unknown[] = []): Promise<T> {
  const rows = (await tx.query(sql, params)) as T[];
  return rows[0];
}

const DAY = 86400_000;
const HOUR = 3600_000;

/** Lleva una fecha pasada a horario laboral (9–18 h en Madrid aprox.). */
function workHours(d: Date, salt: number): Date {
  const out = new Date(d);
  out.setUTCHours(7 + (salt % 10), (salt * 17) % 60, 0, 0);
  return out;
}

// Generador determinista para que la demo sea siempre igual.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface DemoContact {
  name: string;
  company?: string;
  city: string;
  cp: string;
  service: number; // índice en la lista de servicios
  source: string;
  stage: string;
  daysAgo: number;
  amount?: number; // euros
  owner: "owner" | "s1" | "s2" | null;
  timeframe?: string;
  description?: string;
  nextAction?: string;
  nextInDays?: number;
  lostReason?: string;
}

const CONTACTS: DemoContact[] = [
  { name: "Marta Soler Ribas", city: "Gandia", cp: "46701", service: 2, source: "formulario_web", stage: "nuevo", daysAgo: 0.1, owner: null, timeframe: "un_mes", description: "Casa de dos plantas, 140 m². Ahora tienen caldera de gasoil y quieren pasar a aerotermia con suelo radiante en planta baja." },
  { name: "Javier Morant", city: "Oliva", cp: "46780", service: 0, source: "formulario_web", stage: "nuevo", daysAgo: 0.4, owner: null, timeframe: "urgente", description: "Dos splits para dormitorios. Piso de 85 m², tercera planta con terraza." },
  { name: "Comunidad de Propietarios Mar Blau", company: "CP Mar Blau", city: "Dénia", cp: "03700", service: 3, source: "email", stage: "nuevo", daysAgo: 1.2, owner: "owner", timeframe: "tres_meses", description: "Consulta para instalación fotovoltaica de autoconsumo colectivo en cubierta comunitaria." },
  { name: "Laura Peiró", city: "Xàtiva", cp: "46800", service: 0, source: "telefono", stage: "pendiente_contactar", daysAgo: 2, owner: "s1", timeframe: "un_mes", nextAction: "Llamar para concretar visita", nextInDays: 0 },
  { name: "Andrés Bellver", city: "Alzira", cp: "46600", service: 5, source: "recomendacion", stage: "pendiente_contactar", daysAgo: 3, owner: "s2", nextAction: "Confirmar modelo de la máquina averiada", nextInDays: -1 },
  { name: "Clínica Dental Ferrandis", company: "Clínica Dental Ferrandis S.L.", city: "Gandia", cp: "46702", service: 1, source: "portal", stage: "pendiente_contactar", daysAgo: 4, amount: 9800, owner: "owner", timeframe: "tres_meses", nextAction: "Pedir planos del local", nextInDays: 1 },
  { name: "Rosa Llinares", city: "Ontinyent", cp: "46870", service: 3, source: "feria", stage: "visita_programada", daysAgo: 6, amount: 7400, owner: "s1", timeframe: "tres_meses", nextAction: "Visita técnica en cubierta", nextInDays: 1 },
  { name: "Vicent Climent", city: "Tavernes de la Valldigna", cp: "46760", service: 2, source: "formulario_web", stage: "visita_programada", daysAgo: 8, amount: 11500, owner: "s2", timeframe: "un_mes", nextAction: "Visita para medir estancias", nextInDays: 2 },
  { name: "Panadería Hermanos Gil", company: "Hermanos Gil C.B.", city: "Oliva", cp: "46780", service: 0, source: "visita_tienda", stage: "visita_programada", daysAgo: 9, amount: 3200, owner: "owner", nextAction: "Visita obrador", nextInDays: 4 },
  { name: "Elena Martí Pons", city: "Gandia", cp: "46730", service: 3, source: "formulario_web", stage: "presupuesto_enviado", daysAgo: 14, amount: 6900, owner: "s1", timeframe: "un_mes", nextAction: "Resolver dudas sobre baterías", nextInDays: 2 },
  { name: "Gestoría Alcover", company: "Alcover Asesores S.L.", city: "Alzira", cp: "46600", service: 1, source: "recomendacion", stage: "presupuesto_enviado", daysAgo: 18, amount: 14200, owner: "owner", nextAction: "Llamar para conocer decisión", nextInDays: -2 },
  { name: "Pau Sanchis", city: "Xàtiva", cp: "46800", service: 0, source: "telefono", stage: "presupuesto_enviado", daysAgo: 11, amount: 2450, owner: "s2" },
  { name: "Inmaculada Fus", city: "Dénia", cp: "03700", service: 2, source: "portal", stage: "seguimiento", daysAgo: 25, amount: 12800, owner: "s1", nextAction: "Enviar ficha técnica de la bomba de calor", nextInDays: 0 },
  { name: "Hotel Rural El Molí", company: "El Molí Turismo Rural S.L.", city: "Bocairent", cp: "46880", service: 3, source: "feria", stage: "seguimiento", daysAgo: 32, amount: 23900, owner: "owner", nextAction: "Reunión con la propiedad", nextInDays: 5 },
  { name: "Carlos Mompó", city: "Ontinyent", cp: "46870", service: 0, source: "formulario_web", stage: "seguimiento", daysAgo: 20, amount: 1850, owner: "s2", nextAction: "Recordatorio de presupuesto", nextInDays: -3 },
  { name: "Neus Garcia Estruch", city: "Gandia", cp: "46701", service: 3, source: "recomendacion", stage: "ganado", daysAgo: 45, amount: 7650, owner: "s1" },
  { name: "Talleres Bataller", company: "Talleres Bataller S.A.", city: "Alzira", cp: "46600", service: 1, source: "email", stage: "ganado", daysAgo: 62, amount: 18400, owner: "owner" },
  { name: "Josep Ferrer", city: "Oliva", cp: "46780", service: 0, source: "telefono", stage: "ganado", daysAgo: 70, amount: 2900, owner: "s2" },
  { name: "Amparo Vidal", city: "Xàtiva", cp: "46800", service: 2, source: "formulario_web", stage: "ganado", daysAgo: 95, amount: 10900, owner: "s1" },
  { name: "Farmacia Calatayud", company: "Farmacia Calatayud C.B.", city: "Gandia", cp: "46702", service: 0, source: "visita_tienda", stage: "ganado", daysAgo: 120, amount: 4100, owner: "owner" },
  { name: "Miguel Ángel Roig", city: "Dénia", cp: "03700", service: 3, source: "portal", stage: "ganado", daysAgo: 140, amount: 8200, owner: "s2" },
  { name: "Silvia Escrivà", city: "Tavernes de la Valldigna", cp: "46760", service: 4, source: "recomendacion", stage: "ganado", daysAgo: 160, amount: 5600, owner: "s1" },
  { name: "Tomás Gisbert", city: "Ontinyent", cp: "46870", service: 0, source: "formulario_web", stage: "perdido", daysAgo: 38, amount: 2200, owner: "s2", lostReason: "Eligió una oferta más barata" },
  { name: "Lucía Penadés", city: "Alzira", cp: "46600", service: 2, source: "formulario_web", stage: "perdido", daysAgo: 80, amount: 9900, owner: "s1", lostReason: "Pospone la obra al año que viene" },
  { name: "Restaurante La Llotja", company: "La Llotja Hostelería S.L.", city: "Dénia", cp: "03700", service: 1, source: "feria", stage: "perdido", daysAgo: 130, amount: 15800, owner: "owner", lostReason: "No responde tras tres intentos" },
  { name: "Ramón Faus", city: "Gandia", cp: "46730", service: 5, source: "telefono", stage: "ganado", daysAgo: 28, amount: 260, owner: "s2" },
  { name: "Isabel Torró", city: "Oliva", cp: "46780", service: 3, source: "formulario_web", stage: "perdido", daysAgo: 150, amount: 6100, owner: "s1", lostReason: "Sin viabilidad técnica (sombras en cubierta)" },
  { name: "Francesc Boluda", city: "Xàtiva", cp: "46800", service: 0, source: "recomendacion", stage: "ganado", daysAgo: 175, amount: 3300, owner: "owner" },
];

type Line = [string, number, string, number, number?]; // descripción, cantidad, unidad, precio €, IVA

// Conceptos genéricos con precios de ejemplo (no son tarifas reales).
const QUOTE_LINES: Record<number, Line[]> = {
  0: [
    ["Equipo split de pared 1x1, clase energética A++ (modelo a definir tras visita)", 1, "ud", 890],
    ["Instalación: línea frigorífica hasta 3 m, desagüe y conexión eléctrica", 1, "ud", 340],
    ["Metro adicional de línea frigorífica", 2, "m", 38],
  ],
  1: [
    ["Equipo de conductos inverter (potencia según cálculo de cargas)", 1, "ud", 3900],
    ["Red de conductos de fibra y rejillas de impulsión y retorno", 1, "ud", 2650],
    ["Termostato de control por zonas", 4, "ud", 145],
    ["Mano de obra de instalación y puesta en marcha", 1, "ud", 1450],
  ],
  2: [
    ["Bomba de calor aire-agua (aerotermia) con depósito de ACS", 1, "ud", 6900],
    ["Adaptación de circuito hidráulico existente", 1, "ud", 1650],
    ["Desmontaje y retirada de caldera antigua", 1, "ud", 380],
    ["Puesta en marcha, legalización y documentación", 1, "ud", 520],
  ],
  3: [
    ["Módulo fotovoltaico monocristalino (potencia según estudio)", 10, "ud", 165],
    ["Inversor híbrido", 1, "ud", 1450],
    ["Estructura de fijación para cubierta", 1, "ud", 680],
    ["Instalación, cableado y protecciones", 1, "ud", 1250],
    ["Tramitación de legalización", 1, "ud", 350],
  ],
  4: [
    ["Batería de litio (capacidad según consumo)", 1, "ud", 3900],
    ["Integración con instalación existente", 1, "ud", 650],
  ],
  5: [
    ["Diagnóstico y reparación de avería", 1, "h", 55],
    ["Carga de gas refrigerante", 1, "ud", 120],
  ],
};

export interface DemoUsers {
  owner: string;
  s1: string;
  s2: string;
}

export async function clearCompanyData(tx: Q, companyId: string) {
  await tx.query(`delete from quotes where company_id = $1`, [companyId]);
  await tx.query(`delete from tasks where company_id = $1`, [companyId]);
  await tx.query(`delete from activities where company_id = $1`, [companyId]);
  await tx.query(`delete from contacts where company_id = $1`, [companyId]);
  await tx.query(`delete from automation_runs where company_id = $1`, [companyId]);
  await tx.query(`delete from email_outbox where company_id = $1`, [companyId]);
  await tx.query(`delete from counters where company_id = $1`, [companyId]);
}

/** Elimina solo los registros marcados como demo (para empresas reales). */
export async function clearDemoRecords(tx: Q, companyId: string) {
  await tx.query(`delete from quotes where company_id = $1 and (is_demo or contact_id in (select id from contacts where company_id = $1 and is_demo))`, [companyId]);
  await tx.query(`delete from tasks where company_id = $1 and is_demo`, [companyId]);
  await tx.query(`delete from activities where company_id = $1 and is_demo`, [companyId]);
  await tx.query(`delete from contacts where company_id = $1 and is_demo`, [companyId]);
}

export async function seedDemoData(tx: Q, companyId: string, users: DemoUsers, now = new Date()) {
  const rand = rng(20261015);
  const services = (await tx.query(`select id, name from services where company_id = $1 order by sort, name`, [companyId])) as { id: string; name: string }[];
  const svc = (i: number) => services[i % Math.max(services.length, 1)]?.id ?? null;
  const owner = (k: DemoContact["owner"]) => (k ? users[k] : null);
  const company = await one<{ quote_prefix: string; quote_validity_days: number }>(tx, `select quote_prefix, quote_validity_days from companies where id = $1`, [companyId]);

  const STAGE_ORDER = ["nuevo", "pendiente_contactar", "visita_programada", "presupuesto_enviado", "seguimiento", "ganado"];

  for (const [idx, c] of CONTACTS.entries()) {
    const rawCreated = new Date(now.getTime() - c.daysAgo * DAY - Math.floor(rand() * 5) * HOUR);
    const created = c.daysAgo < 1 ? rawCreated : workHours(rawCreated, idx * 3 + 1);
    const phone = `600 000 ${String(100 + idx).padStart(3, "0")}`;
    const email = `${c.name.split(" ")[0]!.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${idx}@cliente.example`;
    const nextAt = c.nextInDays !== undefined ? new Date(now.getTime() + c.nextInDays * DAY + 10 * HOUR - (now.getTime() % DAY)) : null;
    const stageChanged = new Date(Math.min(now.getTime(), created.getTime() + Math.max(0.2, c.daysAgo * 0.6) * DAY));
    const row = await one<{ id: string; folio: string }>(
      tx,
      `insert into contacts(company_id, name, company_name, phone, email, city, postal_code, service_id, source, owner_id,
          estimated_amount_cents, stage, stage_changed_at, lost_reason, next_action, next_action_at, timeframe, description,
          consent_at, is_demo, created_by, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true,$20,$21,$21)
       returning id, folio`,
      [
        companyId, c.name, c.company ?? null, phone, email, c.city, c.cp, svc(c.service), c.source, owner(c.owner),
        c.amount ? c.amount * 100 : null, c.stage, c.stage === "nuevo" ? created : stageChanged, c.lostReason ?? null,
        c.nextAction ?? null, nextAt, c.timeframe ?? null, c.description ?? null,
        c.source === "formulario_web" ? created : null, users.owner, created,
      ],
    );

    // Historial de fases coherente con la fase actual.
    const path = c.stage === "perdido" ? ["nuevo", "pendiente_contactar", "presupuesto_enviado", "perdido"] : STAGE_ORDER.slice(0, STAGE_ORDER.indexOf(c.stage) + 1);
    let prev: string | null = null;
    for (const [i, st] of path.entries()) {
      const at = i === 0 ? created : workHours(new Date(created.getTime() + (i / Math.max(path.length - 1, 1)) * (stageChanged.getTime() - created.getTime())), idx + i * 2);
      await tx.query(
        `insert into stage_history(company_id, contact_id, from_stage, to_stage, user_id, created_at, note) values ($1,$2,$3,$4,$5,$6,$7)`,
        [companyId, row.id, prev, st, i === 0 ? null : owner(c.owner), at, st === "perdido" ? c.lostReason ?? null : null],
      );
      prev = st;
    }

    await tx.query(
      `insert into activities(company_id, contact_id, user_id, type, body, is_demo, created_at) values ($1,$2,$3,$4,$5,true,$6)`,
      [companyId, row.id, null, c.source === "formulario_web" ? "formulario" : "sistema",
        c.source === "formulario_web" ? "Solicitud recibida desde el formulario web." : "Contacto registrado.", created],
    );
    if (!["nuevo"].includes(c.stage)) {
      await tx.query(
        `insert into activities(company_id, contact_id, user_id, type, body, is_demo, created_at) values ($1,$2,$3,'llamada',$4,true,$5)`,
        [companyId, row.id, owner(c.owner) ?? users.owner, "Primera llamada: se explican opciones y se acuerda el siguiente paso.", c.daysAgo < 1 ? created : workHours(new Date(created.getTime() + 0.6 * DAY), idx + 5)],
      );
    }

    // Presupuestos para oportunidades avanzadas.
    if (["presupuesto_enviado", "seguimiento", "ganado", "perdido"].includes(c.stage) && c.amount) {
      const status = c.stage === "ganado" ? "aceptado" : c.stage === "perdido" ? "rechazado" : "enviado";
      const issue = workHours(new Date(created.getTime() + Math.min(c.daysAgo * 0.4, 6) * DAY), idx + 2);
      const lines = QUOTE_LINES[c.service] ?? QUOTE_LINES[0];
      // Escala los precios de ejemplo hacia el importe estimado de la oportunidad.
      const base = lines.reduce((a, [, q, , p]) => a + q * p, 0);
      const factor = c.amount / base;
      const items = lines.map(([d, q, u, p, t]) => ({ description: d, quantity: q, unit: u, unitPriceCents: Math.max(100, Math.round(p * factor) * 100), discountPct: 0, taxRate: t ?? 21 }));
      const totals = computeQuote(items);
      const year = issue.getUTCFullYear();
      const n = Number((await one<{ n: string }>(tx, `select next_counter($1, $2) as n`, [companyId, `quote:${year}`])).n);
      const code = `${company.quote_prefix}-${year}-${String(n).padStart(4, "0")}`;
      const sent = new Date(issue.getTime() + 2 * HOUR);
      const q = await one<{ id: string }>(
        tx,
        `insert into quotes(company_id, contact_id, number, code, title, status, issue_date, valid_until, notes, next_step,
            subtotal_cents, tax_cents, total_cents, reviewed_by, reviewed_at, sent_at, decided_at, is_demo, created_by, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::date,($7::date + $8::int),$9,$10,$11,$12,$13,$14,$15,$16,$17,true,$14,$18,$18) returning id`,
        [
          companyId, row.id, n, code, `Presupuesto · ${services[c.service % services.length]?.name ?? "Instalación"}`, status,
          issue.toISOString().slice(0, 10), company.quote_validity_days,
          "Precios de ejemplo de la demostración: no corresponden a tarifas reales.",
          status === "enviado" ? "Llamar al cliente para resolver dudas" : null,
          totals.subtotalCents, totals.taxCents, totals.totalCents, users.owner, issue, sent,
          status === "enviado" ? null : new Date(sent.getTime() + 4 * DAY), issue,
        ],
      );
      await tx.query(`update contacts set estimated_amount_cents = $2 where id = $1`, [row.id, totals.subtotalCents]);
      for (const [pos, it] of items.entries()) {
        await tx.query(
          `insert into quote_items(company_id, quote_id, position, description, quantity, unit, unit_price_cents, discount_pct, tax_rate, line_net_cents)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [companyId, q.id, pos, it.description, it.quantity, it.unit, it.unitPriceCents, 0, it.taxRate, totals.lines[pos]],
        );
      }
      await tx.query(
        `insert into activities(company_id, contact_id, quote_id, user_id, type, body, is_demo, created_at) values ($1,$2,$3,$4,'presupuesto',$5,true,$6)`,
        [companyId, row.id, q.id, owner(c.owner) ?? users.owner, `Presupuesto ${code} enviado al cliente.`, sent],
      );
    }

    // Tareas y visitas.
    if (c.nextAction && nextAt) {
      const isVisit = c.stage === "visita_programada";
      await tx.query(
        `insert into tasks(company_id, kind, title, due_at, ends_at, location, contact_id, assigned_to, is_demo, created_by, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
        [
          companyId, isVisit ? "visita" : "tarea", isVisit ? `Visita técnica · ${c.name}` : c.nextAction, nextAt,
          isVisit ? new Date(nextAt.getTime() + 1.5 * HOUR) : null, isVisit ? `${c.city} (${c.cp})` : null,
          row.id, owner(c.owner) ?? users.owner, users.owner, created,
        ],
      );
    }
  }

  // Tareas generales sin contacto.
  await tx.query(
    `insert into tasks(company_id, kind, title, due_at, assigned_to, is_demo, created_by, done_at)
     values ($1,'tarea','Revisar presupuestos enviados de la semana',$2,$3,true,$3,null),
            ($1,'tarea','Actualizar fotos de instalaciones para la web',$4,$5,true,$3,$6)`,
    [companyId, new Date(now.getTime() + 2 * DAY), users.owner, new Date(now.getTime() - 3 * DAY), users.s1, new Date(now.getTime() - 2 * DAY)],
  );
}

export const DEMO_COMPANY = {
  slug: "demo",
  name: "Climatización Litoral (demo)",
  legalName: "Empresa ficticia de demostración",
  city: "Gandia",
  province: "Valencia",
  email: "oficina@demo.example",
  phone: "600 000 000",
  schedule: "Lunes a viernes, de 8:00 a 14:00 y de 16:00 a 19:00",
  brandColor: "#23408e",
};

export const DEMO_USERS = [
  { key: "owner" as const, email: "propietario@demo.example", name: "Marina Climent", role: "propietario" },
  { key: "s1" as const, email: "comercial@demo.example", name: "Àlex Navarro", role: "comercial" },
  { key: "s2" as const, email: "tecnico@demo.example", name: "Sergio Pla", role: "comercial" },
];
