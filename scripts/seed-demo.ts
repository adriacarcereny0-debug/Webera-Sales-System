/**
 * Crea (o restaura) la empresa de demostración "demo" con datos ficticios.
 * Solo toca la empresa con slug "demo" y marcada como is_demo; nunca datos reales.
 *
 *   DATABASE_URL=... DEMO_PASSWORD='...' npm run db:seed-demo
 */
import { connect, q } from "./_db";
import { applyCompanyDefaults } from "../src/lib/company-defaults";
import { clearCompanyData, DEMO_COMPANY, DEMO_USERS, seedDemoData } from "../src/lib/demo/seed";
import { hashPassword, passwordProblem, temporaryPassword } from "../src/lib/auth/password";

async function main() {
  const c = await connect();
  const tx = q(c);
  const password = process.env.DEMO_PASSWORD ?? temporaryPassword();
  const problem = passwordProblem(password);
  if (problem) throw new Error(`DEMO_PASSWORD no válida: ${problem}`);
  try {
    await c.query("begin");
    let company = (await tx.query(`select id, is_demo from companies where slug = $1`, [DEMO_COMPANY.slug]))[0] as { id: string; is_demo: boolean } | undefined;
    if (company && !company.is_demo) throw new Error("Existe una empresa con slug 'demo' que NO es de demostración. No se modifica.");
    if (!company) {
      company = (await tx.query(
        `insert into companies(slug, name, legal_name, city, province, email, phone, schedule, brand_color, is_demo, form_photos_enabled,
            privacy_controller, quote_terms, quote_footer, notification_emails)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true,$10,$11,$12,$13) returning id, is_demo`,
        [DEMO_COMPANY.slug, DEMO_COMPANY.name, DEMO_COMPANY.legalName, DEMO_COMPANY.city, DEMO_COMPANY.province, DEMO_COMPANY.email,
          DEMO_COMPANY.phone, DEMO_COMPANY.schedule, DEMO_COMPANY.brandColor, "Climatización Litoral (empresa ficticia)",
          "Presupuesto válido durante el plazo indicado. Precios sujetos a la visita técnica y a la disponibilidad de los equipos.",
          "Documento de demostración: empresa y precios ficticios.", "{oficina@demo.example}"],
      ))[0] as { id: string; is_demo: boolean };
    }
    await applyCompanyDefaults(tx, company.id);
    const hash = await hashPassword(password);
    const ids: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      const row = (await tx.query(
        `insert into users(company_id, email, name, password_hash, role) values ($1,$2,$3,$4,$5)
         on conflict (email) do update set password_hash = excluded.password_hash, active = true, must_change_password = false
         returning id, company_id`,
        [company.id, u.email, u.name, hash, u.role],
      ))[0] as { id: string; company_id: string };
      if (row.company_id !== company.id) throw new Error(`El email ${u.email} pertenece a otra empresa.`);
      ids[u.key] = row.id;
    }
    await clearCompanyData(tx, company.id);
    await seedDemoData(tx, company.id, { owner: ids.owner, s1: ids.s1, s2: ids.s2 });
    await tx.query(`update automations set enabled = true where company_id = $1`, [company.id]);
    await c.query("commit");
    console.log("Demo lista.");
    console.log("  Accesos:", DEMO_USERS.map((u) => `${u.email} (${u.role})`).join(", "));
    if (!process.env.DEMO_PASSWORD) console.log(`  Contraseña generada para los tres usuarios: ${password}`);
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
