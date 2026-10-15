/** Valores iniciales de una empresa nueva. Todo es editable desde Ajustes. */
export type Q = { query: (text: string, params?: unknown[]) => Promise<unknown[]> };

export const DEFAULT_SERVICES = [
  "Aire acondicionado (split)",
  "Climatización por conductos",
  "Aerotermia",
  "Placas solares (autoconsumo)",
  "Baterías y ampliación solar",
  "Mantenimiento y reparación",
];

export const TEMPLATE_KEYS = ["aviso_nueva_solicitud", "seguimiento_presupuesto", "recordatorio_visita", "tarea_contacto_nuevo"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_VARIABLES: Record<TemplateKey, string[]> = {
  aviso_nueva_solicitud: ["empresa", "folio", "nombre", "telefono", "email", "localidad", "servicio", "plazo", "descripcion", "enlace"],
  seguimiento_presupuesto: ["empresa", "codigo", "cliente", "total", "dias", "enviado", "responsable", "enlace"],
  recordatorio_visita: ["empresa", "titulo", "fecha", "hora", "lugar", "cliente", "telefono", "responsable", "enlace"],
  tarea_contacto_nuevo: ["empresa", "folio", "nombre", "telefono", "horas", "enlace"],
};

export const DEFAULT_TEMPLATES: Record<TemplateKey, { name: string; subject: string; body: string }> = {
  aviso_nueva_solicitud: {
    name: "Aviso de nueva solicitud",
    subject: "Nueva solicitud Nº {{folio}}: {{nombre}} ({{servicio}})",
    body:
      "Ha entrado una nueva solicitud desde el formulario web.\n\n" +
      "Nombre: {{nombre}}\nTeléfono: {{telefono}}\nEmail: {{email}}\nLocalidad: {{localidad}}\n" +
      "Instalación: {{servicio}}\nPlazo: {{plazo}}\n\n{{descripcion}}\n\n" +
      "Abrir la ficha: {{enlace}}",
  },
  seguimiento_presupuesto: {
    name: "Recordatorio de seguimiento de presupuesto",
    subject: "Seguimiento pendiente: presupuesto {{codigo}} de {{cliente}}",
    body:
      "El presupuesto {{codigo}} ({{total}}) se envió el {{enviado}} y lleva {{dias}} días sin seguimiento registrado.\n\n" +
      "Responsable: {{responsable}}\n\nSe ha creado una tarea de seguimiento. Abrir el presupuesto: {{enlace}}",
  },
  recordatorio_visita: {
    name: "Recordatorio de visita",
    subject: "Visita {{fecha}} a las {{hora}}: {{cliente}}",
    body:
      "Recordatorio de visita técnica.\n\n{{titulo}}\nFecha: {{fecha}} a las {{hora}}\nLugar: {{lugar}}\n" +
      "Cliente: {{cliente}} · {{telefono}}\nResponsable: {{responsable}}\n\nVer en la agenda: {{enlace}}",
  },
  tarea_contacto_nuevo: {
    name: "Aviso de contacto sin atender",
    subject: "Contacto Nº {{folio}} sin atender: {{nombre}}",
    body:
      "{{nombre}} ({{telefono}}) lleva más de {{horas}} horas como nuevo contacto sin pasar a la siguiente fase.\n\n" +
      "Se ha creado una tarea para llamarle. Abrir la ficha: {{enlace}}",
  },
};

export const AUTOMATION_KEYS = ["aviso_nueva_solicitud", "seguimiento_presupuesto", "recordatorio_visita", "tarea_contacto_nuevo"] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export interface AutomationConfig {
  recipients?: string[];
  days?: number;
  hours?: number;
  hoursBefore?: number;
  createTask?: boolean;
  sendEmail?: boolean;
  notifyAssignee?: boolean;
}

export const AUTOMATION_DEFAULTS: Record<AutomationKey, { title: string; description: string; config: AutomationConfig }> = {
  aviso_nueva_solicitud: {
    title: "Aviso al recibir una nueva solicitud",
    description: "Cuando alguien rellena el formulario web, se envía un email a los destinatarios configurados con los datos de la solicitud.",
    config: { recipients: [], sendEmail: true },
  },
  seguimiento_presupuesto: {
    title: "Recordatorio de presupuesto sin seguimiento",
    description: "Si un presupuesto enviado pasa varios días sin actividad registrada, se crea una tarea de seguimiento para su responsable y se le avisa por email.",
    config: { days: 3, createTask: true, sendEmail: true },
  },
  recordatorio_visita: {
    title: "Aviso de visita próxima",
    description: "Antes de cada visita técnica programada, se envía un recordatorio por email a la persona asignada.",
    config: { hoursBefore: 24, sendEmail: true },
  },
  tarea_contacto_nuevo: {
    title: "Tarea para contactos nuevos sin atender",
    description: "Si un contacto sigue en «Nuevo contacto» pasado el plazo, se crea una tarea para llamarle y se avisa a su responsable.",
    config: { hours: 4, createTask: true, sendEmail: false },
  },
};

/** Inserta servicios, plantillas y automatizaciones por defecto (idempotente). */
export async function applyCompanyDefaults(tx: Q, companyId: string) {
  let i = 0;
  for (const name of DEFAULT_SERVICES) {
    await tx.query(`insert into services(company_id, name, sort) values ($1,$2,$3) on conflict do nothing`, [companyId, name, i++]);
  }
  for (const key of TEMPLATE_KEYS) {
    const t = DEFAULT_TEMPLATES[key];
    await tx.query(
      `insert into email_templates(company_id, key, name, subject, body) values ($1,$2,$3,$4,$5) on conflict do nothing`,
      [companyId, key, t.name, t.subject, t.body],
    );
  }
  for (const key of AUTOMATION_KEYS) {
    await tx.query(
      `insert into automations(company_id, key, enabled, config) values ($1,$2,false,$3) on conflict do nothing`,
      [companyId, key, JSON.stringify(AUTOMATION_DEFAULTS[key].config)],
    );
  }
}

/** Sustituye {{variable}} por valores; las variables desconocidas quedan vacías. */
export function renderTemplate(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === null || v === undefined || v === "" ? "—" : String(v);
  });
}
