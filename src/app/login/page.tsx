import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage() {
  if (await getSession()) redirect("/panel");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <p className="text-[0.95rem] font-semibold tracking-tight">
          Webera <span className="font-normal text-muted">Sales System</span>
        </p>
        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em]">Accede a tu cuenta</h1>
          <p className="mt-1.5 text-[0.95rem] text-muted">Usa el email y la contraseña que te facilitó tu empresa.</p>
          <div className="mt-8"><LoginForm /></div>
        </div>
        <p className="text-[0.8rem] text-muted">¿Has olvidado la contraseña? Pide a la persona administradora de tu empresa que la restablezca.</p>
      </section>

      <aside aria-hidden className="relative hidden overflow-hidden bg-brand-ink text-white lg:flex lg:items-center lg:justify-center">
        <TalonarioStub />
      </aside>
    </main>
  );
}

/** Ilustración tipográfica: una hoja de talonario con su matriz y trepado. */
function TalonarioStub() {
  const rows: [string, string][] = [
    ["Solicitud", "Aerotermia · vivienda unifamiliar"],
    ["Visita", "Jueves, 10:30"],
    ["Presupuesto", "Pendiente de revisión"],
    ["Seguimiento", "En 3 días"],
  ];
  return (
    <div className="w-[min(30rem,80%)] -rotate-[1.5deg]">
      <div className="flex overflow-hidden rounded-md bg-[#fbf1c7] text-[#3b2f00] shadow-[0_30px_60px_-20px_rgb(0_0_0/0.55)]">
        <div className="w-24 shrink-0 border-r border-dashed border-[#d9c46e] px-3 py-5">
          <p className="text-[0.65rem] uppercase tracking-[0.12em] opacity-70">Matriz</p>
          <p className="folio mt-2 text-lg">Nº 000128</p>
        </div>
        <div className="flex-1 px-5 py-5">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">Hoja de seguimiento</p>
            <p className="folio text-lg">Nº 000128</p>
          </div>
          <dl className="mt-4 divide-y divide-[#e6d79a] text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2">
                <dt className="opacity-70">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[0.7rem] opacity-60">Ejemplo ilustrativo</p>
        </div>
      </div>
      <p className="mt-10 max-w-sm rotate-[1.5deg] text-[0.95rem] leading-relaxed text-white/80">
        Cada solicitud con su número, su responsable y su próximo paso. Del primer contacto al presupuesto aceptado.
      </p>
    </div>
  );
}
