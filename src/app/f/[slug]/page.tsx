/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withSystem } from "@/lib/db";
import { brandStyle } from "@/lib/brand";
import { issueFormToken } from "@/lib/form-token";
import { LeadForm } from "./lead-form";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) return null;
  return withSystem(async (tx) => {
    const c = await tx.one<{ id: string; name: string; legal_name: string | null; email: string | null; phone: string | null; brand_color: string; has_logo: boolean;
      form_enabled: boolean; form_photos_enabled: boolean; form_intro: string | null; form_thanks: string | null; privacy_url: string | null; privacy_controller: string | null; is_demo: boolean }>(
      `select id, name, legal_name, email, phone, brand_color, (logo_data is not null) as has_logo, form_enabled, form_photos_enabled,
              form_intro, form_thanks, privacy_url, privacy_controller, is_demo from companies where slug = $1`, [slug]);
    if (!c) return null;
    const services = await tx.query<{ id: string; name: string }>(`select id, name from services where company_id = $1 and active order by sort, name`, [c.id]);
    return { c, services };
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data ? `Solicita presupuesto · ${data.c.name}` : "Formulario no disponible", robots: { index: false } };
}

export default async function PublicFormPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ embed?: string }> }) {
  const { slug } = await params;
  const embed = (await searchParams).embed === "1";
  const data = await load(slug);
  if (!data) notFound();
  const { c, services } = data;

  return (
    <main style={brandStyle(c.brand_color)} className={embed ? "bg-transparent p-1" : "min-h-dvh bg-paper px-4 py-8 sm:py-14"}>
      <div className="mx-auto w-full max-w-xl">
        {!embed && (
          <header className="mb-6 flex items-center gap-3">
            {c.has_logo ? <img src={`/api/public/logo/${slug}`} alt={c.name} className="max-h-12 max-w-44 object-contain" /> : <p className="text-lg font-semibold">{c.name}</p>}
          </header>
        )}
        {c.is_demo && <p className="tint-amarilla tint-chip mb-4 rounded-md px-3 py-2 text-[0.82rem]">Formulario de demostración de una empresa ficticia. Las solicitudes llegan a la cuenta demo.</p>}
        {!c.form_enabled ? (
          <div className="rounded-lg bg-sheet p-6 shadow-sheet ring-1 ring-rule">
            <p className="font-semibold">Formulario no disponible</p>
            <p className="mt-1 text-sm text-muted">{c.phone ? `Puedes contactarnos en el ${c.phone}.` : "Inténtalo más tarde."}</p>
          </div>
        ) : (
          <div className={embed ? "" : "rounded-lg bg-sheet p-5 shadow-sheet ring-1 ring-rule sm:p-7"}>
            {!embed && (
              <>
                <h1 className="text-[1.45rem] font-semibold tracking-[-0.01em]">Solicita tu presupuesto</h1>
                <p className="mt-1 mb-6 text-[0.95rem] text-muted text-pretty">{c.form_intro || "Cuéntanos qué necesitas y te contactamos para valorar la instalación. Sin compromiso."}</p>
              </>
            )}
            <LeadForm slug={slug} token={issueFormToken(slug)} services={services} photosEnabled={c.form_photos_enabled} thanks={c.form_thanks}
              privacy={{ controller: c.privacy_controller || c.legal_name || c.name, email: c.email, url: c.privacy_url }} />
          </div>
        )}
        {!embed && <p className="mt-6 text-center text-[0.75rem] text-faint">Gestionado con Webera Sales System</p>}
      </div>
    </main>
  );
}
