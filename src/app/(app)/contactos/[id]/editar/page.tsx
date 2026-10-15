import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getContact, listServices, listUsers } from "@/server/contacts";
import { getCompany } from "@/server/company";
import { centsToInput } from "@/lib/money";
import { dateToMadridLocal } from "@/lib/dates";
import { PageHeader, Sheet } from "@/components/ui/misc";
import { Folio } from "@/components/ui/folio";
import { ContactForm } from "../../contact-form";

export const metadata: Metadata = { title: "Editar contacto" };

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSession();
  if (!can(s.user.role, "crm.write")) redirect(`/contactos/${id}?aviso=sin_permiso`);
  const data = await tenant(s, async (tx) => {
    const c = await getContact(tx, id);
    if (!c) return null;
    return { c, users: await listUsers(tx), services: await listServices(tx, false), company: await getCompany(tx) };
  });
  if (!data) notFound();
  const { c } = data;
  return (
    <>
      <PageHeader title={`Editar · ${c.name}`} meta={<Folio n={c.folio} className="text-base" />} />
      <Sheet className="max-w-5xl">
        <ContactForm
          cancelHref={`/contactos/${c.id}`}
          users={data.users}
          services={data.services}
          customFields={data.company.custom_fields}
          defaults={{
            id: c.id, name: c.name, company_name: c.company_name ?? "", phone: c.phone ?? "", email: c.email ?? "",
            address: c.address ?? "", city: c.city ?? "", postal_code: c.postal_code ?? "", service_id: c.service_id ?? "",
            source: c.source, owner_id: c.owner_id ?? "",
            estimated_amount: c.estimated_amount_cents ? centsToInput(Number(c.estimated_amount_cents)) : "",
            next_action: c.next_action ?? "", next_action_at: dateToMadridLocal(c.next_action_at), timeframe: c.timeframe ?? "",
            description: c.description ?? "", custom: c.custom_values,
          }}
        />
      </Sheet>
    </>
  );
}
