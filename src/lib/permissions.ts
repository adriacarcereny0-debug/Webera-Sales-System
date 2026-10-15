export type Role = "propietario" | "administrador" | "comercial" | "lectura";

export const ROLE_LABELS: Record<Role, string> = {
  propietario: "Propietario",
  administrador: "Administrador",
  comercial: "Comercial",
  lectura: "Solo lectura",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  propietario: "Acceso total, incluida la gestión de usuarios, exportaciones y datos de la empresa.",
  administrador: "Gestiona contactos, presupuestos, ajustes, plantillas y automatizaciones.",
  comercial: "Trabaja contactos, tareas y presupuestos. No cambia ajustes de la empresa.",
  lectura: "Consulta información sin poder modificarla.",
};

export type Capability =
  | "crm.write"
  | "quotes.write"
  | "quotes.review"
  | "tasks.write"
  | "settings.manage"
  | "users.manage"
  | "automations.manage"
  | "data.export"
  | "data.import"
  | "demo.manage"
  | "audit.view";

const MATRIX: Record<Role, Capability[]> = {
  propietario: [
    "crm.write", "quotes.write", "quotes.review", "tasks.write", "settings.manage", "users.manage",
    "automations.manage", "data.export", "data.import", "demo.manage", "audit.view",
  ],
  administrador: [
    "crm.write", "quotes.write", "quotes.review", "tasks.write", "settings.manage",
    "automations.manage", "data.export", "data.import", "demo.manage", "audit.view",
  ],
  comercial: ["crm.write", "quotes.write", "tasks.write"],
  lectura: [],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role]?.includes(cap) ?? false;
}

export function isRole(v: unknown): v is Role {
  return v === "propietario" || v === "administrador" || v === "comercial" || v === "lectura";
}
