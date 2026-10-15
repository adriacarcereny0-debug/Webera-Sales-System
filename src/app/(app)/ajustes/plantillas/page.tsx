import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { TEMPLATE_VARIABLES, type TemplateKey } from "@/lib/company-defaults";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { TemplateForm } from "./form";

export const metadata: Metadata = { title: "Plantillas de email" };

export default async function TemplatesPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const tpls = await tenant(s, (tx) => tx.query<{ key: TemplateKey; name: string; subject: string; body: string }>(`select key, name, subject, body from email_templates order by name`));
  return (
    <div className="space-y-5">
      <p className="text-[0.9rem] text-muted">Textos de los emails que envían las automatizaciones. Las variables entre llaves se sustituyen por los datos reales.</p>
      {tpls.map((t) => (
        <Sheet key={t.key}>
          <SheetHeader title={t.name} />
          <TemplateForm k={t.key} subject={t.subject} body={t.body} vars={TEMPLATE_VARIABLES[t.key] ?? []} />
        </Sheet>
      ))}
    </div>
  );
}
