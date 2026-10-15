import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-session";
import { env } from "@/lib/env";
import { PageHeader, Sheet } from "@/components/ui/misc";
import { NewCompanyForm } from "../forms";

export const metadata: Metadata = { title: "Alta de cliente" };

export default async function NewCompanyPage() {
  await requireAdmin();
  return (
    <>
      <nav aria-label="Ruta" className="mb-3 text-[0.85rem] text-muted"><Link href="/admin/empresas" className="hover:text-ink hover:underline">Empresas</Link><span aria-hidden className="mx-1.5">/</span>Alta</nav>
      <PageHeader title="Alta de cliente" description="Crea la empresa con sus servicios, plantillas y automatizaciones por defecto, y el acceso de su propietario." />
      <Sheet className="max-w-5xl p-4 md:p-6"><NewCompanyForm appUrl={env.appUrl} /></Sheet>
    </>
  );
}
