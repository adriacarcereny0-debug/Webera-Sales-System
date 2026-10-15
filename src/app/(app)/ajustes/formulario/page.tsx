import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompany } from "@/server/company";
import { env } from "@/lib/env";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { CopyField } from "@/components/ui/copy-field";
import { FormSettings } from "./form";

export const metadata: Metadata = { title: "Formulario web" };

export default async function FormPage() {
  const s = await requireSession();
  if (!can(s.user.role, "settings.manage")) redirect("/ajustes?aviso=sin_permiso");
  const c = await tenant(s, getCompany);
  const link = `${env.appUrl}/f/${c.slug}`;
  const snippet = `<iframe id="webera-form" src="${link}?embed=1" title="Solicitud de presupuesto" style="width:100%;border:0;min-height:760px" loading="lazy"></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "${env.appUrl}" || !e.data || e.data.type !== "webera-form-height") return;
    document.getElementById("webera-form").style.height = e.data.height + "px";
  });
</script>`;
  return (
    <div className="space-y-5">
      <Sheet>
        <SheetHeader title="Enlace directo" description="Compártelo en redes, WhatsApp, Google Business o tu firma de email."
          actions={<Link href={`/f/${c.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[0.85rem] text-brand hover:underline">Abrir<ExternalLink className="size-3.5" strokeWidth={1.75} aria-hidden /></Link>} />
        <div className="p-4 md:p-5"><CopyField value={link} label="Enlace" /></div>
      </Sheet>
      <Sheet>
        <SheetHeader title="Incrustar en tu web" description="Pega este código en la página de contacto (WordPress: bloque «HTML personalizado»). La altura se ajusta sola." />
        <div className="p-4 md:p-5"><CopyField value={snippet} label="Código" multiline /></div>
      </Sheet>
      <Sheet>
        <SheetHeader title="Configuración" />
        <FormSettings c={c} />
      </Sheet>
    </div>
  );
}
