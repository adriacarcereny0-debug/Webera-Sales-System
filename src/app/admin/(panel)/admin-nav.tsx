"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/solicitudes", label: "Solicitudes" },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/usuarios", label: "Usuarios y contraseñas" },
  { href: "/admin/correo", label: "Correo" },
  { href: "/admin/equipo", label: "Equipo Webera" },
  { href: "/admin/actividad", label: "Registro" },
];

export function AdminNav({ newLeads = 0 }: { newLeads?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Consola" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {ITEMS.map((i) => {
          const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={active ? "page" : undefined}
                className={cn("relative inline-flex h-11 items-center px-3 text-[0.88rem] transition-colors",
                  active ? "font-medium text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#c22d29]" : "text-white/60 hover:text-white")}>
                {i.label}
                {i.href === "/admin/solicitudes" && newLeads > 0 && (
                  <span className="num ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c22d29] px-1.5 text-[0.72rem] font-semibold text-white" aria-label={`${newLeads} nuevas`}>{newLeads}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
