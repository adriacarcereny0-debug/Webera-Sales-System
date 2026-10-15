/**
 * Crea (o actualiza la contraseña de) un administrador de la consola /admin.
 * Las credenciales se leen de variables de entorno para que nunca queden en el repositorio:
 *
 *   ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD='…' ADMIN_NAME='Tu nombre' DATABASE_URL=… npm run db:create-admin
 */
import { connect } from "./_db";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Define ADMIN_EMAIL con un email válido.");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres, con letras y números.");
  }
  const c = await connect();
  try {
    const r = await c.query(
      `insert into platform_admins(email, name, password_hash) values ($1, $2, $3)
       on conflict (email) do update set password_hash = excluded.password_hash, active = true
       returning (xmax = 0) as created`,
      [email, name, await hashPassword(password)]);
    await c.query(`delete from platform_sessions where admin_id = (select id from platform_admins where email = $1)`, [email]);
    console.log(r.rows[0].created ? `Administrador creado: ${email}` : `Contraseña actualizada: ${email}`);
    console.log("Acceso: /admin/login");
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
