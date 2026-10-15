import "server-only";
import type { Tx } from "./db";
import type { Session } from "./auth/session";

export async function audit(tx: Tx, s: Session, action: string, entity?: string, entityId?: string | null, detail: Record<string, unknown> = {}) {
  await tx.query(
    `insert into audit_log(company_id, user_id, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5,$6)`,
    [s.company.id, s.user.id, action, entity ?? null, entityId ?? null, JSON.stringify(detail)],
  );
}

export const AUDIT_LABELS: Record<string, string> = {
  "empresa.actualizar": "Actualizó los datos de la empresa",
  "empresa.logo": "Cambió el logotipo",
  "usuario.crear": "Creó un usuario",
  "usuario.actualizar": "Modificó un usuario",
  "usuario.reset_password": "Restableció la contraseña de un usuario",
  "servicio.guardar": "Guardó un servicio",
  "servicio.eliminar": "Eliminó un servicio",
  "plantilla.guardar": "Editó una plantilla de email",
  "automatizacion.guardar": "Configuró una automatización",
  "automatizacion.ejecutar": "Ejecutó las automatizaciones manualmente",
  "formulario.guardar": "Configuró el formulario web",
  "campos.guardar": "Editó los campos personalizados",
  "exportar": "Exportó datos",
  "importar": "Importó contactos",
  "demo.restaurar": "Restauró los datos de demostración",
  "demo.eliminar": "Eliminó los datos de ejemplo",
  "demo.cargar": "Cargó datos de ejemplo",
  "contacto.eliminar": "Eliminó un contacto",
  "presupuesto.eliminar": "Eliminó un presupuesto",
};
