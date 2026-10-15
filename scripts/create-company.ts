/**
 * Alta de una empresa instaladora con su usuario propietario.
 *
 *   DATABASE_URL=... npm run db:create-company -- --slug climatizacion-perez \
 *     --name "Climatización Pérez" --email propietario@ejemplo.es --owner "Ana Pérez"
 *
 * Imprime una contraseña temporal; se pedirá cambiarla en el primer acceso.
 */
import { connect, q } from "./_db";
import { applyCompanyDefaults } from "../src/lib/company-defaults";
import { hashPassword, temporaryPassword } from "../src/lib/auth/password";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("slug");
  const name = arg("name");
  const email = arg("email")?.toLowerCase();
  const owner = arg("owner") ?? "Propietario";
  const color = arg("color") ?? "#23408e";
  if (!slug || !name || !email) throw new Error("Uso: --slug <slug> --name <nombre> --email <email> [--owner <nombre>] [--color #rrggbb]");
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) throw new Error("Slug no válido: minúsculas, números y guiones.");
  const c = await connect();
  const tx = q(c);
  const password = temporaryPassword();
  try {
    await c.query("begin");
    const company = (await tx.query(`insert into companies(slug, name, brand_color, email, notification_emails) values ($1,$2,$3,$4,$5) returning id`,
      [slug, name, color, email, `{${email}}`]))[0] as { id: string };
    await applyCompanyDefaults(tx, company.id);
    await tx.query(`insert into users(company_id, email, name, password_hash, role, must_change_password) values ($1,$2,$3,$4,'propietario',true)`,
      [company.id, email, owner, await hashPassword(password)]);
    await c.query("commit");
    console.log(`Empresa creada: ${name} (${slug})`);
    console.log(`Usuario: ${email}`);
    console.log(`Contraseña temporal: ${password}`);
    console.log(`Formulario público: /f/${slug}`);
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
