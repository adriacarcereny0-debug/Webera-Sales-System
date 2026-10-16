import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Mail, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDateTime, relative } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { LEAD_STATUS, TEAM_SIZES, type LeadStatus, type TeamSize } from "@/server/platform-leads";
import { getPlatformSettings } from "@/lib/email/platform-config";
import { PageHeader, Sheet, EmptyState, Notice } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePlatformLead } from "../../platform-actions";

export const metadata: Metadata = { title: "Solicitudes" };

interface LeadRow {
  id: string; name: string; company: string; email: string; phone: string | null; city: string | null; team_size: TeamSize | null;
  message: string | null; status: LeadStatus; notes: string | null; company_id: string | null; company_name: string | null; source: string | null; created_at: string;
}

const FILTERS: { id: string; label: string }[] = [
  { id: "abiertas", label: "Por atender" },
  { id: "alta", label: "Dadas de alta" },
  { id: "descartada", label: "Descartadas" },
  { id: "todas", label: "Todas" },
];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  await requireAdmin();
  const { estado = "abiertas" } = await searchParams;
  const filter = FILTERS.some((f) => f.id === estado) ? estado : "abiertas";
  const where = filter === "abiertas" ? `l.status in ('nueva','contactada')` : filter === "todas" ? "true" : `l.status = '${filter === "alta" ? "alta" : "descartada"}'`;
  const [{ leads, counts }, mail] = await Promise.all([
    withSystem(async (tx) => ({
      leads: await tx.query<LeadRow>(`select l.*, c.name as company_name from platform_leads l left join companies c on c.id = l.company_id
        where ${where} order by l.status = 'nueva' desc, l.created_at desc limit 200`),
      counts: (await tx.one<Record<string, number>>(`select count(*) filter (where status in ('nueva','contactada'))::int as abiertas,
        count(*) filter (where status = 'alta')::int as alta, count(*) filter (where status = 'descartada')::int as descartada, count(*)::int as todas from platform_leads`))!,
    })),
    getPlatformSettings(),
  ]);
  const publicUrl = env.appUrl;

  return (
    <>
      <PageHeader title="Solicitudes de demostración"
        description={<>Instaladores que han rellenado «Pide una demostración» en <a href={publicUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">{publicUrl.replace(/^https?:\/\//, "")}</a>. Llámales, enséñales la demo y dales de alta con un clic.</>} />

      {!mail.own && !mail.envConfigured && (
        <Notice kind="warn" className="mb-5" title="Las solicitudes no te llegan por email">
          Se guardan aquí, pero para recibir un aviso en tu correo (y que el interesado reciba una respuesta automática) <Link href="/admin/correo" className="font-medium underline underline-offset-2">conecta el correo de Webera</Link>.
        </Notice>
      )}

      <nav aria-label="Filtrar" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f.id} href={f.id === "abiertas" ? "/admin/solicitudes" : `/admin/solicitudes?estado=${f.id}`} aria-current={filter === f.id ? "page" : undefined}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[0.85rem] ring-1 transition-colors",
              filter === f.id ? "bg-ink text-white ring-ink" : "bg-sheet text-ink-2 ring-rule-strong hover:ring-ink/40")}>
            {f.label}<span className={cn("num text-[0.78rem]", filter === f.id ? "text-white/70" : "text-muted")}>{counts[f.id] ?? 0}</span>
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <Sheet>
          <EmptyState title={filter === "abiertas" ? "No hay solicitudes por atender" : "No hay solicitudes aquí"}>
            Comparte la página pública de Webera para que los instaladores pidan su demostración. Añade <span className="font-mono">?utm_source=…</span> al enlace para saber de dónde viene cada uno.
          </EmptyState>
        </Sheet>
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => {
            const st = LEAD_STATUS[l.status];
            const prefill = new URLSearchParams({ solicitud: l.id }).toString();
            return (
              <li key={l.id}>
                <Sheet as="article" className="p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-[1.02rem] font-semibold">{l.company}</span>
                        <Chip tint={st.tint}>{st.label}</Chip>
                        {l.source && <span className="text-[0.76rem] text-muted">vía {l.source}</span>}
                      </p>
                      <p className="mt-0.5 text-[0.86rem] text-ink-2">
                        {l.name}{l.city && <> · {l.city}</>}{l.team_size && <> · {TEAM_SIZES[l.team_size] ?? l.team_size}</>}
                      </p>
                      <p className="mt-0.5 text-[0.78rem] text-muted" title={fmtDateTime(l.created_at)}>Recibida {relative(l.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {l.phone && <ButtonLink href={`tel:${l.phone.replace(/\s+/g, "")}`} variant="secondary" size="sm"><Phone className="size-3.5" strokeWidth={1.8} aria-hidden />{l.phone}</ButtonLink>}
                      <ButtonLink href={`mailto:${l.email}`} variant="secondary" size="sm"><Mail className="size-3.5" strokeWidth={1.8} aria-hidden /><span className="max-w-[14rem] truncate">{l.email}</span></ButtonLink>
                    </div>
                  </div>

                  {l.message && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-[0.88rem] whitespace-pre-line text-ink-2">{l.message}</p>}

                  <div className="mt-4 grid grid-cols-1 gap-4 border-t border-rule pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <form action={updatePlatformLead} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <input type="hidden" name="id" value={l.id} />
                      <label htmlFor={`notes-${l.id}`} className="sr-only">Notas internas</label>
                      <Textarea id={`notes-${l.id}`} name="notes" rows={1} defaultValue={l.notes ?? ""} placeholder="Notas: cuándo le llamaste, qué le interesa…" className="min-h-9 md:min-h-9" />
                      <SubmitButton variant="secondary" size="sm" pendingLabel="Guardando…" className="shrink-0">Guardar nota</SubmitButton>
                    </form>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {l.status === "alta" && l.company_id ? (
                        <ButtonLink href={`/admin/empresas/${l.company_id}`} variant="secondary" size="sm"><ExternalLink className="size-3.5" strokeWidth={1.8} aria-hidden />Ver {l.company_name ?? "empresa"}</ButtonLink>
                      ) : (
                        <>
                          {l.status === "nueva" && (
                            <form action={updatePlatformLead}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="contactada" />
                              <SubmitButton variant="secondary" size="sm" pendingLabel="…">Marcar contactada</SubmitButton></form>
                          )}
                          {l.status !== "descartada" ? (
                            <form action={updatePlatformLead}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="descartada" />
                              <SubmitButton variant="ghost" size="sm" pendingLabel="…">Descartar</SubmitButton></form>
                          ) : (
                            <form action={updatePlatformLead}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value="nueva" />
                              <SubmitButton variant="ghost" size="sm" pendingLabel="…">Recuperar</SubmitButton></form>
                          )}
                          <ButtonLink href={`/admin/empresas/nueva?${prefill}`} variant="primary" size="sm">Dar de alta</ButtonLink>
                        </>
                      )}
                    </div>
                  </div>
                </Sheet>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
