import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin-session";
import { WeberaWordmark } from "@/components/brand/webera-mark";
import { AdminLoginForm } from "./form";

export const metadata: Metadata = { title: "Consola Webera" };

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#0c1229] px-4 py-10">
      {/* Trama de trepado como textura de fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1.3px)", backgroundSize: "18px 18px" }} />
      <p aria-hidden className="folio pointer-events-none absolute -right-6 bottom-6 text-[9rem] leading-none text-[#c22d29]/20 select-none sm:text-[13rem]">Nº 000001</p>
      <div className="relative w-full max-w-sm">
        <WeberaWordmark tone="light" sub="Consola de plataforma" />
        <div className="mt-8 rounded-xl bg-sheet p-6 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/10 sm:p-7">
          <h1 className="text-[1.35rem] font-semibold tracking-[-0.015em]">Acceso de administración</h1>
          <p className="mt-1 mb-6 text-[0.9rem] text-muted">Solo para el equipo de Webera. Los clientes entran por <a href="/login" className="text-brand underline">/login</a>.</p>
          <AdminLoginForm />
        </div>
        <p className="mt-6 text-center text-[0.75rem] text-white/45">Los accesos quedan registrados.</p>
      </div>
    </main>
  );
}
