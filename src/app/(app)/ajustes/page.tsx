import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Circle } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { getCompany } from "@/server/company";
import { emailConfigStatus } from "@/lib/email/provider";
import { env } from "@/lib/env";
import { Sheet, SheetHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsHome() {
  const s = await requireSession();
  const d = await tenant(s, async (tx) => ({
    company: await getCompany(tx),
    users: (await tx.one<{ n: number }>(`select count(*)::int as n from users where active`))?.n ?? 0,
    autos: (await tx.one<{ n: number }>(`select count(*)::int as n from automations where enabled`))?.n ?? 0,
    services: (await tx.one<{ n: number }>(`select count(*)::int as n from services where active`))?.n ?? 0,
  }));
  const c = d.company;
  const email = emailConfigStatus();
  const steps = [
    { done: !!(c.legal_name && c.tax_id && c.phone && c.email), label: "Datos fiscales y de contacto", hint: "Aparecen en los presupuestos.", href: "/ajustes/empresa" },
    { done: c.has_logo, label: "Logotipo y color de marca", hint: "Se usan en la aplicación, el formulario y el PDF.", href: "/ajustes/empresa" },
    { done: d.services > 0, label: "Servicios que ofreces", hint: `${d.services} activos.`, href: "/ajustes/servicios" },
    { done: d.users > 1, label: "Invitar al equipo", hint: `${d.users} usuario${d.users === 1 ? "" : "s"} activo${d.users === 1 ? "" : "s"}.`, href: "/ajustes/usuarios" },
    { done: !!(c.privacy_url || c.privacy_controller), label: "Texto de privacidad del formulario", hint: "Revisa el responsable y el enlace a tu política.", href: "/ajustes/formulario" },
    { done: d.autos > 0, label: "Activar automatizaciones", hint: `${d.autos} de 4 activas.`, href: "/automatizaciones" },
    { done: email.configured, label: "Envío de emails (Resend o SMTP)", hint: email.configured ? `Proveedor: ${email.provider}.` : "Lo configura Webera en las variables del servidor.", href: "/automatizaciones" },
    { done: !!env.cronSecret, label: "Ejecución programada de recordatorios", hint: "CRON_SECRET en el servidor.", href: "/automatizaciones" },
  ];
  const done = steps.filter((x) => x.done).length;
  return (
    <Sheet>
      <SheetHeader title="Puesta en marcha" description={`${done} de ${steps.length} pasos completados`} />
      <div className="px-4 pt-3 md:px-5" aria-hidden>
        <div className="h-1.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-rule">
          <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-rule px-2 py-2">
        {steps.map((st) => (
          <li key={st.label}>
            <Link href={st.href} className="flex items-start gap-3 rounded-md px-2 py-3 hover:bg-paper md:px-3">
              {st.done ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" strokeWidth={1.75} aria-label="Hecho" /> : <Circle className="mt-0.5 size-5 shrink-0 text-faint" strokeWidth={1.75} aria-label="Pendiente" />}
              <span>
                <span className={cn("block text-[0.92rem]", st.done ? "text-ink-2" : "font-medium text-ink")}>{st.label}</span>
                <span className="block text-[0.8rem] text-muted">{st.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
