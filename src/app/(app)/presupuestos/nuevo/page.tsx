import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getCompany } from "@/server/company";
import { addDaysIso, todayMadrid } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { QuoteEditor } from "../quote-editor";
import { editorContacts } from "../editor-data";

export const metadata: Metadata = { title: "Nuevo presupuesto" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ contacto?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!can(s.user.role, "quotes.write")) redirect("/presupuestos?aviso=sin_permiso");
  const contactId = sp.contacto && /^[0-9a-f-]{36}$/.test(sp.contacto) ? sp.contacto : "";
  const { company, contacts, service } = await tenant(s, async (tx) => ({
    company: await getCompany(tx),
    contacts: await editorContacts(tx, contactId || undefined),
    service: contactId ? await tx.one<{ name: string }>(`select s.name from contacts c join services s on s.id = c.service_id where c.id = $1`, [contactId]) : null,
  }));
  const today = todayMadrid();
  const defaultTax = Number(company.default_tax_rate);
  return (
    <>
      <PageHeader title="Nuevo presupuesto" description="Se guarda como borrador. Antes de enviarlo al cliente, una persona con permiso de revisión debe darlo por revisado." />
      <QuoteEditor
        cancelHref={contactId ? `/contactos/${contactId}` : "/presupuestos"}
        contacts={contacts}
        taxRates={company.tax_rates}
        defaultTax={defaultTax}
        defaults={{
          contact_id: contactId, title: service ? `Presupuesto · ${service.name}` : "Presupuesto de instalación",
          issue_date: today, valid_until: addDaysIso(today, company.quote_validity_days),
          notes: "", next_step: "", terms: company.quote_terms ?? "", lines: [],
        }}
      />
    </>
  );
}
