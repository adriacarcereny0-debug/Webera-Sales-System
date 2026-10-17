import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-session";
import { withSystem } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import type { Role } from "@/lib/permissions";
import { PageHeader, Sheet, SheetHeader, Notice, Definition } from "@/components/ui/misc";
import { Chip } from "@/components/ui/chip";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { CompanyUserRow, EditCompanyForm, NewCompanyUserForm } from "../forms";
import { DeleteCompany } from "./danger";
import { restoreCompanyDemo } from "../../../actions";
import { ACTION_LABELS } from "../../labels";

export const metadata: Metadata = { title: "Empresa" };

export default async function CompanyAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await withSystem(async (tx) => {
    const c = await tx.one<{ id: string; name: string; slug: string; brand_color: string; plan_note: string | null; active: boolean; is_demo: boolean; created_at: string; legal_name: string | null; tax_id: string | null; email: string | null; phone: string | null; city: string | null }>(
      `select id, name, slug, brand_color, plan_note, active, is_demo, created_at, legal_name, tax_id, email, phone, city from companies where id = $1`, [id]);
    if (!c) return null;
    return {
      c,
      users: await tx.query<{ id: string; name: string; email: string; role: Role; active: boolean; must_change_password: boolean; last_login_at: string | null }>(
        `select id, name, email, role, active, must_change_password, last_login_at from users where company_id = $1 order by active desc, role, name`, [id]),
      stats: (await tx.one<{ contacts: number; open: number; quotes: number; accepted: string; tasks: number; outbox_err: number; email_from: string | null; sent_month: number }>(`
        select (select count(*)::int from contacts where company_id = $1) as contacts,
               (select count(*)::int from contacts where company_id = $1 and stage not in ('ganado','perdido')) as open,
               (select count(*)::int from quotes where company_id = $1) as quotes,
               (select coalesce(sum(subtotal_cents),0) from quotes where company_id = $1 and status = 'aceptado') as accepted,
               (select count(*)::int from tasks where company_id = $1 and done_at is null) as tasks,
               (select count(*)::int from email_outbox where company_id = $1 and status in ('error','no_configurado')) as outbox_err,
               (select from_email from company_email_settings where company_id = $1) as email_from,
               (select count(*)::int from email_outbox where company_id = $1 and status = 'aceptado' and sent_at >= date_trunc('month', now())) as sent_month`, [id]))!,
      audit: await tx.query<{ action: string; target: string | null; created_at: string; admin: string | null }>(
        `select a.action, a.target, a.created_at, p.name as admin from platform_audit a left join platform_admins p on p.id = a.admin_id where a.company_id = $1 order by a.created_at desc limit 10`, [id]),
    };
  });
  if (!data) notFound();
  const { c, users, stats, audit } = data;
  return (
    <>
      <nav aria-label="Ruta" className="mb-3 text-[0.85rem] text-muted"><Link href="/admin/empresas" className="hover:text-ink hover:underline">Empresas</Link><span aria-hidden className="mx-1.5">/</span>{c.name}</nav>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3"><span className="size-4 rounded-full" style={{ background: c.brand_color }} aria-hidden />{c.name}{c.is_demo && <Chip tint="tint-amarilla">Demo</Chip>}{!c.active && <Chip tint="tint-gris">Suspendida</Chip>}</span>}
        description={<span className="font-mono text-[0.85rem]">/{c.slug} · alta {fmtDate(c.created_at)}</span>}
        actions={<a href={`/f/${c.slug}`} target="_blank" rel="noopener" className={buttonClass("secondary")}><ExternalLink className="size-4" strokeWidth={1.75} aria-hidden />Formulario web</a>}
      />
      {sp.aviso === "restaurada" && <Notice kind="ok" className="mb-5">Demo restaurada a su estado inicial.</Notice>}
      {!c.active && <Notice kind="warn" className="mb-5" title="Cuenta suspendida">Sus usuarios no pueden entrar y el formulario no acepta solicitudes. Los datos se conservan.</Notice>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <Sheet>
            <SheetHeader title="Usuarios y contraseñas" description="Crea accesos para el cliente o restablece contraseñas. La contraseña nueva se muestra una sola vez para que la copies." />
            <ul className="divide-y divide-rule">
              {users.map((u) => <li key={u.id} className={u.active ? "" : "opacity-70"}><CompanyUserRow u={{ ...u, lastLoginLabel: u.last_login_at ? `Último acceso ${fmtDateTime(u.last_login_at)}` : undefined }} appUrl={env.appUrl} /></li>)}
            </ul>
          </Sheet>
          <Sheet>
            <SheetHeader title="Añadir usuario a esta empresa" />
            <NewCompanyUserForm companyId={c.id} appUrl={env.appUrl} />
          </Sheet>
          <Sheet>
            <SheetHeader title="Datos de la cuenta" />
            <EditCompanyForm c={c} />
          </Sheet>
        </div>
        <div className="space-y-5 xl:sticky xl:top-6">
          <Sheet>
            <SheetHeader title="Uso" />
            <dl className="divide-y divide-rule px-4">
              <Definition term="Contactos">{stats.contacts} <span className="text-muted">({stats.open} abiertos)</span></Definition>
              <Definition term="Presupuestos">{stats.quotes}</Definition>
              <Definition term="Aceptado">{formatCents(stats.accepted)}</Definition>
              <Definition term="Tareas pendientes">{stats.tasks}</Definition>
              <Definition term="Correo de envío">{stats.email_from ? <>{stats.email_from} · {stats.sent_month} este mes</> : <span className="text-warn">Sin conectar</span>}</Definition>
              <Definition term="Emails sin enviar">{stats.outbox_err ? <span className="text-warn">{stats.outbox_err}</span> : 0}</Definition>
            </dl>
          </Sheet>
          <Sheet>
            <SheetHeader title="Ficha" />
            <dl className="divide-y divide-rule px-4">
              <Definition term="Razón social">{c.legal_name}</Definition>
              <Definition term="NIF">{c.tax_id}</Definition>
              <Definition term="Email">{c.email}</Definition>
              <Definition term="Teléfono">{c.phone}</Definition>
              <Definition term="Localidad">{c.city}</Definition>
            </dl>
            <p className="px-4 pb-3 text-[0.76rem] text-muted">Estos datos los completa el cliente desde sus Ajustes.</p>
          </Sheet>
          {audit.length > 0 && (
            <Sheet>
              <SheetHeader title="Cambios de Webora Studio" />
              <ul className="space-y-2 px-4 py-3 text-[0.82rem]">
                {audit.map((a, i) => <li key={i}><span className="font-medium">{a.admin}</span> {ACTION_LABELS[a.action] ?? a.action}{a.target ? ` · ${a.target}` : ""}<span className="block text-[0.74rem] text-muted">{fmtDateTime(a.created_at)}</span></li>)}
              </ul>
            </Sheet>
          )}
          <Sheet className="ring-[color-mix(in_oklab,var(--danger)_30%,white)]">
            <SheetHeader title="Zona delicada" />
            <div className="flex flex-wrap gap-2 p-4">
              {c.is_demo && (
                <ConfirmAction label="Restaurar la demo" title="¿Restaurar esta demo?" confirmLabel="Restaurar" confirmVariant="primary" action={restoreCompanyDemo} fields={{ id: c.id }}>
                  Se borran sus contactos, presupuestos, tareas y emails y se vuelven a crear los datos ficticios.
                </ConfirmAction>
              )}
              <DeleteCompany id={c.id} slug={c.slug} name={c.name} />
            </div>
          </Sheet>
        </div>
      </div>
    </>
  );
}
