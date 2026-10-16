import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { TEAM_SIZES, type TeamSize } from "@/server/platform-leads";
import { PageHeader, Sheet, Notice } from "@/components/ui/misc";
import { NewCompanyForm, type CompanyPrefill } from "../forms";

export const metadata: Metadata = { title: "Alta de cliente" };

export default async function NewCompanyPage({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  await requireAdmin();
  const { solicitud } = await searchParams;
  const lead = solicitud && /^[0-9a-f-]{36}$/.test(solicitud)
    ? await withSystem((tx) => tx.one<{ id: string; name: string; company: string; email: string; phone: string | null; city: string | null; team_size: TeamSize | null; status: string }>(
      `select id, name, company, email, phone, city, team_size, status from platform_leads where id = $1`, [solicitud]))
    : null;
  const prefill: CompanyPrefill | undefined = lead && lead.status !== "alta" ? {
    leadId: lead.id, name: lead.company, ownerName: lead.name, ownerEmail: lead.email,
    note: [lead.phone && `Tel. ${lead.phone}`, lead.city, lead.team_size && TEAM_SIZES[lead.team_size]].filter(Boolean).join(" · "),
  } : undefined;
  return (
    <>
      <nav aria-label="Ruta" className="mb-3 text-[0.85rem] text-muted"><Link href="/admin/empresas" className="hover:text-ink hover:underline">Empresas</Link><span aria-hidden className="mx-1.5">/</span>Alta</nav>
      <PageHeader title="Alta de cliente" description="Crea la empresa con sus servicios, plantillas y automatizaciones por defecto, y el acceso de su propietario." />
      {prefill && (
        <Notice kind="info" className="mb-5 max-w-5xl" title={`Datos copiados de la solicitud de ${prefill.ownerName}`}>
          Revísalos y pulsa «Crear empresa y acceso». La solicitud quedará marcada como dada de alta.
        </Notice>
      )}
      <Sheet className="max-w-5xl p-4 md:p-6"><NewCompanyForm appUrl={env.appUrl} prefill={prefill} /></Sheet>
    </>
  );
}
