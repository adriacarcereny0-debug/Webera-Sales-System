import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { CUSTOMER_TEMPLATES, DEFAULT_TEMPLATES, TEMPLATE_KEYS, TEMPLATE_VARIABLES, type TemplateKey } from "@/lib/company-defaults";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { TemplateForm } from "./form";

export const metadata: Metadata = { title: "Plantillas de email" };

export default async function TemplatesPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const rows = await tenant(s, (tx) => tx.query<{ key: TemplateKey; subject: string; body: string }>(`select key, subject, body from email_templates`));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const all = TEMPLATE_KEYS.map((k) => ({ ...DEFAULT_TEMPLATES[k], ...(byKey.get(k) ?? {}), key: k }));
  const groups = [
    { title: "Correos que reciben tus clientes", description: "Salen desde tu correo de envío, con el nombre de tu empresa.", list: all.filter((t) => CUSTOMER_TEMPLATES.includes(t.key)) },
    { title: "Avisos para tu equipo", description: "Los recibe la persona responsable o los destinatarios que configures.", list: all.filter((t) => !CUSTOMER_TEMPLATES.includes(t.key)) },
  ];
  return (
    <div className="space-y-5">
      <p className="text-[0.9rem] text-muted">Textos de los emails que envían las automatizaciones. Las variables entre llaves se sustituyen por los datos reales.</p>
      {groups.map((g) => (
        <section key={g.title} className="space-y-3">
          <div>
            <h2 className="text-[1rem] font-semibold text-ink">{g.title}</h2>
            <p className="text-[0.84rem] text-muted">{g.description}</p>
          </div>
          {g.list.map((t) => (
            <Sheet key={t.key}>
              <SheetHeader title={DEFAULT_TEMPLATES[t.key].name} />
              <TemplateForm k={t.key} subject={t.subject} body={t.body} vars={TEMPLATE_VARIABLES[t.key] ?? []} />
            </Sheet>
          ))}
        </section>
      ))}
    </div>
  );
}
