import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, Download, Pencil } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getQuote } from "@/server/quotes";
import { getCompany } from "@/server/company";
import { fmtDateTime, todayMadrid } from "@/lib/dates";
import { PageHeader, Sheet, SheetHeader, Notice, Definition } from "@/components/ui/misc";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { QuoteStatusChip } from "@/components/ui/chip";
import { Flash } from "@/components/ui/flash";
import { ConfirmAction } from "@/components/ui/confirm";
import { QuoteDocument } from "@/components/quote-document";
import { StatusActions } from "./status-actions";
import { SendQuoteForm } from "./send-quote";
import { CopyField } from "@/components/ui/copy-field";
import { env } from "@/lib/env";
import { createQuoteLink, deleteQuote, duplicateQuote } from "../actions";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await requireSession();
  const data = await tenant(s, async (tx) => {
    const q = await getQuote(tx, id);
    if (!q) return null;
    const history = await tx.query<{ body: string; created_at: string; user_name: string | null }>(
      `select a.body, a.created_at, u.name as user_name from activities a left join users u on u.id = a.user_id where a.quote_id = $1 order by a.created_at desc`, [id]);
    return { ...q, history, company: await getCompany(tx) };
  });
  if (!data) notFound();
  const { quote, items, history, company } = data;
  const canWrite = can(s.user.role, "quotes.write");
  const editable = quote.status === "borrador" || quote.status === "revisado";
  const expired = quote.status === "enviado" && quote.valid_until < todayMadrid();

  return (
    <>
      <nav aria-label="Ruta" className="mb-3 text-[0.85rem] text-muted">
        <Link href="/presupuestos" className="hover:text-ink hover:underline">Presupuestos</Link><span aria-hidden className="mx-1.5">/</span>
        <Link href={`/contactos/${quote.contact_id}`} className="hover:text-ink hover:underline">{quote.contact_name}</Link>
      </nav>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3"><span className="folio">{quote.code}</span><QuoteStatusChip status={quote.status} /></span>}
        description={quote.title}
        actions={
          <>
            <a href={`/api/quotes/${quote.id}/pdf`} className={buttonClass("secondary")}><Download className="size-4" strokeWidth={1.75} aria-hidden />Descargar PDF</a>
            {canWrite && editable && <ButtonLink href={`/presupuestos/${quote.id}/editar`} variant="primary"><Pencil className="size-4" strokeWidth={1.75} aria-hidden />Editar</ButtonLink>}
          </>
        }
      />
      <Flash code={sp.aviso} />
      {quote.status === "borrador" && <Notice kind="warn" className="mb-5" title="Borrador pendiente de revisión">Revisa conceptos, cantidades, precios e IVA antes de enviarlo. El PDF de un borrador lleva la marca «BORRADOR».</Notice>}
      {expired && <Notice kind="warn" className="mb-5">La validez de este presupuesto terminó. Puedes marcarlo como caducado o duplicarlo con nueva fecha.</Notice>}

      <div className="grid-cols-1 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuoteDocument quote={quote} items={items} company={company} />
        <div className="space-y-5 xl:sticky xl:top-6">
          {canWrite && (quote.status === "revisado" || quote.status === "enviado") && !expired && (
            <Sheet>
              <SheetHeader title="Enviar al cliente" description="Lo recibe por email y lo acepta desde el móvil." />
              <div className="space-y-4 p-4">
                <SendQuoteForm id={quote.id} email={quote.emailed_to ?? quote.contact_email} again={!!quote.emailed_at} />
                {quote.public_token ? (
                  <div className="space-y-1.5 border-t border-rule pt-4">
                    <CopyField value={`${env.appUrl}/p/${quote.public_token}`} label="Enlace del cliente (para WhatsApp)" />
                    <p className="text-[0.78rem] text-muted">
                      {quote.emailed_at ? `Enviado a ${quote.emailed_to} el ${fmtDateTime(quote.emailed_at)}. ` : ""}
                      {quote.client_viewed_at ? `El cliente lo abrió el ${fmtDateTime(quote.client_viewed_at)}.` : "El cliente aún no lo ha abierto."}
                    </p>
                  </div>
                ) : (
                  <form action={createQuoteLink} className="border-t border-rule pt-4">
                    <input type="hidden" name="id" value={quote.id} />
                    <button type="submit" className={buttonClass("secondary", "sm", "w-full")}>Crear enlace para WhatsApp</button>
                  </form>
                )}
              </div>
            </Sheet>
          )}
          {canWrite && quote.client_note && (
            <Notice kind="info" title="Comentario del cliente">«{quote.client_note}»</Notice>
          )}
          {canWrite && (
            <Sheet>
              <SheetHeader title="Estado" />
              <div className="p-4"><StatusActions id={quote.id} status={quote.status} canReview={can(s.user.role, "quotes.review")} /></div>
            </Sheet>
          )}
          <Sheet>
            <SheetHeader title="Control" />
            <dl className="divide-y divide-rule px-4">
              <Definition term="Creado">{fmtDateTime(quote.created_at)}{quote.creator_name ? ` · ${quote.creator_name}` : ""}</Definition>
              <Definition term="Revisado">{quote.reviewed_at ? `${fmtDateTime(quote.reviewed_at)} · ${quote.reviewer_name ?? ""}` : <span className="text-warn">Pendiente</span>}</Definition>
              <Definition term="Enviado">{quote.sent_at ? fmtDateTime(quote.sent_at) : null}</Definition>
              <Definition term="Decisión">{quote.decided_at ? fmtDateTime(quote.decided_at) : null}</Definition>
              {quote.next_step && <Definition term="Próximo paso">{quote.next_step}</Definition>}
            </dl>
          </Sheet>
          <Sheet>
            <SheetHeader title="Historial" />
            <ol className="space-y-3 px-4 py-3">
              {history.map((h, i) => (
                <li key={i} className="text-[0.84rem]">
                  <p className="text-ink-2">{h.body}</p>
                  <p className="text-[0.76rem] text-muted">{fmtDateTime(h.created_at)}{h.user_name ? ` · ${h.user_name}` : ""}</p>
                </li>
              ))}
            </ol>
          </Sheet>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <form action={duplicateQuote}>
                <input type="hidden" name="id" value={quote.id} />
                <button type="submit" className={buttonClass("secondary", "sm")}><Copy className="size-4" strokeWidth={1.75} aria-hidden />Duplicar como plantilla</button>
              </form>
              {(quote.status === "borrador" || can(s.user.role, "settings.manage")) && (
                <ConfirmAction label="Eliminar" size="sm" variant="ghost" title={`¿Eliminar ${quote.code}?`} confirmLabel="Eliminar" action={deleteQuote} fields={{ id: quote.id }}>
                  Se borrará el presupuesto y sus líneas. El número no se reutiliza.
                </ConfirmAction>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
