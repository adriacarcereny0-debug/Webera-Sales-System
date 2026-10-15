import type { Metadata } from "next";
import { requireSession, tenant } from "@/lib/auth/session";
import { can, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { NewUserForm, UserRow } from "./forms";

export const metadata: Metadata = { title: "Usuarios y permisos" };

const MATRIX: [string, Role[]][] = [
  ["Ver contactos, presupuestos y agenda", ["propietario", "administrador", "comercial", "lectura"]],
  ["Crear y editar contactos, tareas y presupuestos", ["propietario", "administrador", "comercial"]],
  ["Dar presupuestos por revisados", ["propietario", "administrador"]],
  ["Ajustes, plantillas y automatizaciones", ["propietario", "administrador"]],
  ["Importar y exportar datos", ["propietario", "administrador"]],
  ["Gestionar usuarios", ["propietario"]],
];

export default async function UsersPage() {
  const s = await requireSession();
  const canManage = can(s.user.role, "users.manage");
  const users = await tenant(s, (tx) => tx.query<{ id: string; name: string; email: string; role: Role; active: boolean }>(
    `select id, name, email, role, active from users order by active desc, role, name`));
  const allowOwner = s.user.role === "propietario";
  return (
    <div className="space-y-5">
      <Sheet>
        <SheetHeader title="Equipo" description={canManage ? "Cada persona entra con su propio email y contraseña." : "Solo el propietario puede gestionar usuarios."} />
        <ul className="divide-y divide-rule">
          {users.map((u) => <li key={u.id} className={u.active ? "" : "opacity-70"}><UserRow u={u} isSelf={u.id === s.user.id} canManage={canManage} allowOwner={allowOwner} /></li>)}
        </ul>
      </Sheet>
      {canManage && (
        <Sheet>
          <SheetHeader title="Añadir usuario" description="Se genera una contraseña temporal que deberá cambiar en su primer acceso." />
          <NewUserForm allowOwner={allowOwner} />
        </Sheet>
      )}
      <Sheet>
        <SheetHeader title="Qué puede hacer cada rol" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-[0.78rem] text-muted">
                <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Permiso</th>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <th key={r} scope="col" className="px-3 py-2.5 text-center font-medium" title={ROLE_DESCRIPTIONS[r]}>{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([label, roles]) => (
                <tr key={label} className="border-b border-rule last:border-0">
                  <th scope="row" className="py-2.5 pr-3 pl-5 text-left font-normal text-ink-2">{label}</th>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">{roles.includes(r) ? <span className="text-ok">Sí</span> : <span className="text-faint">No</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sheet>
    </div>
  );
}
