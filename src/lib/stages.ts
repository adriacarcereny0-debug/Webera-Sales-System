export const STAGES = [
  "nuevo",
  "pendiente_contactar",
  "visita_programada",
  "presupuesto_enviado",
  "seguimiento",
  "ganado",
  "perdido",
] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Cada fase toma el tinte de una copia del talonario autocopiativo.
 * `tint` es la clase utilitaria definida en globals.css.
 */
export const STAGE_META: Record<Stage, { label: string; short: string; tint: string; hint: string }> = {
  nuevo: { label: "Nuevo contacto", short: "Nuevo", tint: "tint-blanca", hint: "Acaba de entrar. Asigna responsable y primer paso." },
  pendiente_contactar: { label: "Pendiente de contactar", short: "Pendiente", tint: "tint-amarilla", hint: "Hay que llamar o escribir." },
  visita_programada: { label: "Visita programada", short: "Visita", tint: "tint-azul", hint: "Visita técnica en agenda." },
  presupuesto_enviado: { label: "Presupuesto enviado", short: "Enviado", tint: "tint-rosa", hint: "Presupuesto en manos del cliente." },
  seguimiento: { label: "Seguimiento", short: "Seguimiento", tint: "tint-oro", hint: "Negociación o recordatorio pendiente." },
  ganado: { label: "Ganado", short: "Ganado", tint: "tint-verde", hint: "Aceptado. Pasa a cliente." },
  perdido: { label: "Perdido", short: "Perdido", tint: "tint-gris", hint: "No sale adelante. Anota el motivo." },
};

export const OPEN_STAGES: Stage[] = ["nuevo", "pendiente_contactar", "visita_programada", "presupuesto_enviado", "seguimiento"];

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

export const SOURCES = {
  formulario_web: "Formulario web",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  email: "Email",
  recomendacion: "Recomendación",
  feria: "Feria o evento",
  portal: "Portal de reformas",
  visita_tienda: "Visita a tienda",
  importacion: "Importación CSV",
  otro: "Otro",
} as const;
export type Source = keyof typeof SOURCES;
export function isSource(v: unknown): v is Source {
  return typeof v === "string" && v in SOURCES;
}

export const QUOTE_STATUS = {
  borrador: { label: "Borrador", tint: "tint-blanca" },
  revisado: { label: "Revisado", tint: "tint-azul" },
  enviado: { label: "Enviado", tint: "tint-rosa" },
  aceptado: { label: "Aceptado", tint: "tint-verde" },
  rechazado: { label: "Rechazado", tint: "tint-gris" },
  caducado: { label: "Caducado", tint: "tint-amarilla" },
} as const;
export type QuoteStatus = keyof typeof QUOTE_STATUS;
export function isQuoteStatus(v: unknown): v is QuoteStatus {
  return typeof v === "string" && v in QUOTE_STATUS;
}

/**
 * Transiciones permitidas de presupuesto. Un presupuesto solo puede marcarse
 * como enviado después de haber sido revisado.
 */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  borrador: ["revisado"],
  revisado: ["borrador", "enviado"],
  enviado: ["aceptado", "rechazado", "caducado", "borrador"],
  aceptado: [],
  rechazado: ["borrador"],
  caducado: ["borrador"],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_TRANSITIONS[from].includes(to);
}

export const TIMEFRAMES = {
  urgente: "Urgente (menos de 2 semanas)",
  un_mes: "En el próximo mes",
  tres_meses: "En 1–3 meses",
  sin_prisa: "Sin fecha decidida",
} as const;
