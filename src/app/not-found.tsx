import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="folio text-[2.5rem]">Nº 404</p>
      <h1 className="mt-2 text-xl font-semibold">Esta página no existe</h1>
      <p className="mt-1 text-muted">O no pertenece a tu empresa. Comprueba el enlace.</p>
      <Link href="/panel" className={buttonClass("primary", "md", "mt-6")}>Ir al panel</Link>
    </main>
  );
}
