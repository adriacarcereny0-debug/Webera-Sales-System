import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listServices, listUsers } from "@/server/contacts";
import { getCompany } from "@/server/company";
import { PageHeader, Sheet } from "@/components/ui/misc";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = { title: "Nuevo contacto" };

export default async function NewContactPage() {
  const s = await requireSession();
  if (!can(s.user.role, "crm.write")) redirect("/contactos?aviso=sin_permiso");
  const { users, services, company } = await tenant(s, async (tx) => ({
    users: await listUsers(tx), services: await listServices(tx), company: await getCompany(tx),
  }));
  return (
    <>
      <PageHeader title="Nuevo contacto" description="Registra una solicitud recibida por teléfono, email, WhatsApp o en persona. Se le asignará el siguiente número de folio." />
      <Sheet className="max-w-5xl">
        <ContactForm defaults={{ owner_id: s.user.id }} users={users} services={services} customFields={company.custom_fields} cancelHref="/contactos" />
      </Sheet>
    </>
  );
}
