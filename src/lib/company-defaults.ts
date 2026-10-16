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

export const TEMPLATE_KEYS = [
  "aviso_nueva_solicitud", "seguimiento_presupuesto", "recordatorio_visita", "tarea_contacto_nuevo",
  "respuesta_cliente", "envio_presupuesto", "recordatorio_visita_cliente", "seguimiento_cliente",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Plantillas que recibe el cliente final (las demás son avisos internos para el equipo). */
export const CUSTOMER_TEMPLATES: TemplateKey[] = ["respuesta_cliente", "envio_presupuesto", "recordatorio_visita_cliente", "seguimiento_cliente"];

export const TEMPLATE_VARIABLES: Record<TemplateKey, string[]> = {
  aviso_nueva_solicitud: ["empresa", "folio", "nombre", "telefono", "email", "localidad", "servicio", "plazo", "descripcion", "enlace"],
  seguimiento_presupuesto: ["empresa", "codigo", "cliente", "total", "dias", "enviado", "responsable", "enlace"],
  recordatorio_visita: ["empresa", "titulo", "fecha", "hora", "lugar", "cliente", "telefono", "responsable", "enlace"],
  tarea_contacto_nuevo: ["empresa", "folio", "nombre", "telefono", "horas", "enlace"],
  respuesta_cliente: ["empresa", "nombre", "folio", "servicio", "telefono_empresa", "email_empresa"],
  envio_presupuesto: ["empresa", "nombre", "codigo", "total", "valido_hasta", "enlace", "telefono_empresa", "email_empresa"],
  recordatorio_visita_cliente: ["empresa", "nombre", "fecha", "hora", "lugar", "tecnico", "telefono_empresa", "email_empresa"],
  seguimiento_cliente: ["empresa", "nombre", "codigo", "total", "enlace", "telefono_empresa", "email_empresa"],
};

const firma = "\n\nUn saludo,\n{{empresa}}\n{{telefono_empresa}}";

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
  respuesta_cliente: {
    name: "Al cliente: confirmación de solicitud recibida",
    subject: "Hemos recibido tu solicitud Nº {{folio}} · {{empresa}}",
    body:
      "Hola, {{nombre}}:\n\nGracias por contactar con {{empresa}}. Hemos recibido tu solicitud (Nº {{folio}}) sobre {{servicio}}.\n\n" +
      "Te llamaremos lo antes posible para concretar los detalles. Si lo necesitas, puedes responder a este correo." + firma,
  },
  envio_presupuesto: {
    name: "Al cliente: envío del presupuesto",
    subject: "Tu presupuesto {{codigo}} · {{empresa}}",
    body:
      "Hola, {{nombre}}:\n\nTe enviamos el presupuesto {{codigo}} por un total de {{total}} (IVA incluido), válido hasta el {{valido_hasta}}.\n\n" +
      "Puedes verlo, descargarlo en PDF y aceptarlo desde este enlace:\n{{enlace}}\n\n" +
      "Si tienes cualquier duda, responde a este correo." + firma,
  },
  recordatorio_visita_cliente: {
    name: "Al cliente: recordatorio de visita",
    subject: "Te recordamos la visita de {{empresa}}: {{fecha}} a las {{hora}}",
    body:
      "Hola, {{nombre}}:\n\nTe recordamos que tenemos una visita técnica contigo:\n\n" +
      "Día: {{fecha}}\nHora: {{hora}}\nLugar: {{lugar}}\nTécnico: {{tecnico}}\n\n" +
      "Si no te va bien, respóndenos a este correo y buscamos otro momento." + firma,
  },
  seguimiento_cliente: {
    name: "Al cliente: seguimiento del presupuesto",
    subject: "¿Has podido revisar el presupuesto {{codigo}}?",
    body:
      "Hola, {{nombre}}:\n\nHace unos días te enviamos el presupuesto {{codigo}} ({{total}}). ¿Has podido revisarlo?\n\n" +
      "Puedes verlo y aceptarlo aquí: {{enlace}}\n\nSi tienes dudas o quieres ajustar algo, responde a este correo y lo vemos." + firma,
  },
};

export const AUTOMATION_KEYS = [
  "respuesta_cliente", "aviso_nueva_solicitud", "asignacion_automatica", "unificar_duplicados", "tarea_contacto_nuevo",
  "fase_automatica", "tarea_tras_visita", "recordatorio_visita", "recordatorio_visita_cliente",
  "seguimiento_presupuesto", "seguimiento_cliente", "caducar_presupuestos", "resumen_diario",
] as const;
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

export type AutomationGroup = "entrada" | "venta" | "avisos";

export const AUTOMATION_GROUPS: Record<AutomationGroup, { title: string; description: string }> = {
  entrada: { title: "Cuando llega una solicitud", description: "Lo que pasa solo en el momento en que un cliente rellena tu formulario." },
  venta: { title: "Mientras se trabaja la venta", description: "Mueve las fichas y crea las tareas para que nada se quede parado." },
  avisos: { title: "Recordatorios y avisos", description: "Correos al equipo y a los clientes en el momento justo." },
};

export const AUTOMATION_DEFAULTS: Record<AutomationKey, {
  title: string; description: string; group: AutomationGroup; enabledByDefault: boolean;
  /** Cuándo se dispara, en una frase. */ when: string; config: AutomationConfig;
}> = {
  respuesta_cliente: {
    group: "entrada", enabledByDefault: true, when: "Al instante",
    title: "Contestar al cliente que ha escrito",
    description: "Le llega un correo de tu empresa confirmando que habéis recibido su solicitud, con su número. Así sabe que no se ha perdido.",
    config: { sendEmail: true },
  },
  aviso_nueva_solicitud: {
    group: "entrada", enabledByDefault: true, when: "Al instante",
    title: "Avisaros de cada solicitud nueva",
    description: "Os llega un email con todos los datos del cliente y el enlace a su ficha.",
    config: { recipients: [], sendEmail: true },
  },
  asignacion_automatica: {
    group: "entrada", enabledByDefault: true, when: "Al instante",
    title: "Repartir las solicitudes por turnos",
    description: "Cada solicitud nueva se asigna a una persona del equipo (por turnos, a quien menos contactos abiertos tenga) y se le pone «Llamar» como próximo paso.",
    config: { hours: 2 },
  },
  unificar_duplicados: {
    group: "entrada", enabledByDefault: true, when: "Al instante",
    title: "Juntar solicitudes repetidas",
    description: "Si alguien que ya está en tu lista vuelve a escribir (mismo email o teléfono), se añade a su ficha en lugar de crear otra.",
    config: {},
  },
  tarea_contacto_nuevo: {
    group: "entrada", enabledByDefault: true, when: "Cada 15 minutos",
    title: "Tarea si nadie ha llamado",
    description: "Si un contacto sigue en «Nuevo contacto» pasado el plazo, se crea una tarea para llamarle.",
    config: { hours: 4, createTask: true, sendEmail: false },
  },
  fase_automatica: {
    group: "venta", enabledByDefault: true, when: "Al instante",
    title: "Mover la ficha de fase sola",
    description: "Al programar una visita pasa a «Visita programada»; al enviar el presupuesto, a «Presupuesto enviado»; si lo acepta, a «Ganado»; si lo rechaza, a «Perdido».",
    config: {},
  },
  tarea_tras_visita: {
    group: "venta", enabledByDefault: true, when: "Al marcar la visita como hecha",
    title: "Preparar el presupuesto después de la visita",
    description: "Cuando marcas una visita como hecha, se crea la tarea «Preparar presupuesto» para el mismo responsable, para el día siguiente.",
    config: { createTask: true },
  },
  caducar_presupuestos: {
    group: "venta", enabledByDefault: true, when: "Cada día",
    title: "Caducar presupuestos vencidos",
    description: "Los presupuestos enviados que pasan su fecha de validez sin respuesta se marcan como caducados, y se crea una tarea para llamar al cliente.",
    config: { createTask: true },
  },
  recordatorio_visita: {
    group: "avisos", enabledByDefault: true, when: "Antes de cada visita",
    title: "Recordar la visita al técnico",
    description: "El técnico asignado recibe un correo con la dirección, la hora y el teléfono del cliente.",
    config: { hoursBefore: 24, sendEmail: true },
  },
  recordatorio_visita_cliente: {
    group: "avisos", enabledByDefault: true, when: "Antes de cada visita",
    title: "Recordar la visita al cliente",
    description: "El cliente recibe un correo el día antes con la fecha y la hora, para que esté en casa. Reduce las visitas en vano.",
    config: { hoursBefore: 24, sendEmail: true },
  },
  seguimiento_presupuesto: {
    group: "avisos", enabledByDefault: true, when: "Cada día",
    title: "Recordaros los presupuestos sin respuesta",
    description: "Si un presupuesto enviado pasa varios días sin novedades, se crea una tarea de seguimiento para su responsable y se le avisa por email.",
    config: { days: 3, createTask: true, sendEmail: true },
  },
  seguimiento_cliente: {
    group: "avisos", enabledByDefault: false, when: "Cada día",
    title: "Recordar el presupuesto al cliente",
    description: "Si el cliente no ha respondido pasados unos días, le llega un correo amable con el enlace para ver y aceptar el presupuesto. Solo una vez por presupuesto.",
    config: { days: 5, sendEmail: true },
  },
  resumen_diario: {
    group: "avisos", enabledByDefault: true, when: "Cada mañana",
    title: "Resumen del día para cada persona",
    description: "Cada mañana, cada persona del equipo recibe sus visitas y tareas del día, lo que tiene atrasado y las solicitudes nuevas sin atender. Si no tiene nada, no se envía.",
    config: { sendEmail: true },
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
      `insert into automations(company_id, key, enabled, config) values ($1,$2,$3,$4) on conflict do nothing`,
      [companyId, key, AUTOMATION_DEFAULTS[key].enabledByDefault, JSON.stringify(AUTOMATION_DEFAULTS[key].config)],
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
