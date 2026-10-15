import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { WeberaWordmark } from "@/components/brand/webera-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage() {
  if (await getSession()) redirect("/panel");
  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <WeberaWordmark sub="Sales System" />
        <div className="mx-auto w-full max-w-sm py-14">
          <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">Accede a tu cuenta</h1>
          <p className="mt-2.5 text-[0.98rem] text-muted">Usa el email y la contraseña que te facilitó tu empresa o Webera.</p>
          <div className="mt-9"><LoginForm /></div>
        </div>
        <p className="max-w-sm text-[0.8rem] leading-relaxed text-muted">¿Has olvidado la contraseña? Pide a la persona responsable de tu empresa que la restablezca, o escríbenos.</p>
      </section>

      <aside aria-hidden className="relative hidden overflow-hidden bg-brand-ink text-white lg:flex lg:flex-col lg:justify-center lg:px-16 xl:px-24">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1.3px)", backgroundSize: "18px 18px" }} />
        <p className="relative max-w-md text-[2.1rem] leading-[1.12] font-semibold tracking-[-0.025em] text-balance">
          Que ninguna solicitud se quede en el cajón.
        </p>
        <p className="relative mt-4 max-w-md text-[1rem] leading-relaxed text-white/70">
          Cada contacto con su número, su responsable y su próximo paso. Del formulario de tu web al presupuesto aceptado.
        </p>
        <div className="relative mt-12 h-[19rem] w-full max-w-[32rem]">
          <CarbonCopies />
        </div>
      </aside>
    </main>
  );
}

/** Las tres copias del talonario, ligeramente desplazadas como al arrancarlas. */
function CarbonCopies() {
  const rows: [string, string, string][] = [
    ["Solicitud", "Aerotermia · vivienda de 140 m²", "tint-blanca"],
    ["Visita técnica", "Jueves, 10:30", "tint-azul"],
    ["Presupuesto", "Revisado, listo para enviar", "tint-rosa"],
    ["Seguimiento", "Llamar en 3 días", "tint-oro"],
  ];
  return (
    <>
      <div className="absolute inset-x-6 top-8 h-64 rotate-[3.5deg] rounded-md bg-[#fbe3ea] shadow-[0_20px_40px_-18px_rgb(0_0_0/0.5)]" />
      <div className="absolute inset-x-3 top-4 h-64 rotate-[1.6deg] rounded-md bg-[#fbf1c7] shadow-[0_20px_40px_-18px_rgb(0_0_0/0.5)]" />
      <div className="absolute inset-x-0 top-0 flex h-64 -rotate-[0.8deg] overflow-hidden rounded-md bg-white text-ink shadow-[0_34px_70px_-24px_rgb(0_0_0/0.65)]">
        <div className="flex w-24 shrink-0 flex-col justify-between border-r border-dashed border-rule-strong bg-paper px-3 py-4">
          <p className="folio text-[1.05rem]">Nº 000128</p>
          <p className="text-[0.68rem] leading-snug text-muted">Ejemplo ilustrativo</p>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.95rem] font-semibold">Marta S. · Gandia</p>
            <p className="folio text-[1.05rem]">Nº 000128</p>
          </div>
          <dl className="mt-3 divide-y divide-rule text-[0.84rem]">
            {rows.map(([k, v, t]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-2">
                <dt className="flex items-center gap-2 text-muted"><span className={`${t} tint-chip size-2.5 rounded-full`} />{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </>
  );
}
