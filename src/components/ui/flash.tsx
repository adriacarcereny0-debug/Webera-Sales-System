import { Notice } from "./misc";

const MESSAGES: Record<string, { kind: "ok" | "info" | "warn"; text: string }> = {
  creado: { kind: "ok", text: "Contacto creado." },
  guardado: { kind: "ok", text: "Cambios guardados." },
  eliminado: { kind: "ok", text: "Eliminado correctamente." },
  presupuesto_creado: { kind: "ok", text: "Borrador de presupuesto creado. Revísalo antes de enviarlo." },
  presupuesto_guardado: { kind: "ok", text: "Presupuesto guardado." },
  importado: { kind: "ok", text: "Importación completada." },
  restaurada: { kind: "ok", text: "La demostración se ha restaurado a su estado inicial." },
  sin_permiso: { kind: "warn", text: "Tu usuario no tiene permiso para esa acción." },
  password: { kind: "ok", text: "Contraseña actualizada." },
};

export function Flash({ code }: { code?: string | string[] }) {
  const c = Array.isArray(code) ? code[0] : code;
  const m = c ? MESSAGES[c] : undefined;
  if (!m) return null;
  return <Notice kind={m.kind} className="mb-5">{m.text}</Notice>;
}
