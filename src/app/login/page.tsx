import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { WeberaWordmark } from "@/components/brand/webera-mark";
import { LoginForm } from "./login-form";
import { StoryDeck } from "./deck";

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

      <aside className="relative overflow-hidden bg-brand-ink px-6 py-12 text-white sm:px-12 lg:flex lg:flex-col lg:justify-center lg:px-16 xl:px-24">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1.3px)", backgroundSize: "18px 18px" }} />
        <div className="relative max-w-[30rem]">
          <p className="text-[0.85rem] font-medium text-white/55">Cómo funciona, en 5 pasos</p>
          <p className="mt-2 text-[2rem] leading-[1.12] font-semibold tracking-[-0.025em] text-balance">
            Que ninguna solicitud se quede en el cajón.
          </p>
          <p className="mt-3 text-[1rem] leading-relaxed text-white/70">
            Así viaja un cliente desde tu web hasta el presupuesto aceptado. Pulsa la ficha.
          </p>
          <div className="mt-10"><StoryDeck /></div>
        </div>
      </aside>
    </main>
  );
}
