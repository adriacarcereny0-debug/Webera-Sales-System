"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarClock, CircleHelp, FileText, Gauge, Kanban, Menu, Settings, Users, Workflow, X,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/panel", label: "Panel", Icon: Gauge },
  { href: "/contactos", label: "Contactos", Icon: Users },
  { href: "/pipeline", label: "Pipeline", Icon: Kanban },
  { href: "/presupuestos", label: "Presupuestos", Icon: FileText },
  { href: "/agenda", label: "Agenda y tareas", Icon: CalendarClock },
  { href: "/automatizaciones", label: "Automatizaciones", Icon: Workflow },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
  { href: "/ayuda", label: "Manual de uso", Icon: CircleHelp },
];

export function NavLinks({ onNavigate, badges = {} }: { onNavigate?: () => void; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        const badge = badges[href];
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-md px-3 text-[0.9rem] transition-colors duration-150 md:h-9",
                active ? "bg-white/14 font-medium text-white" : "text-white/72 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-white/60 group-hover:text-white/85")} strokeWidth={1.6} aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              {badge ? (
                <span className="num rounded-[4px] bg-[#fbf1c7] px-1.5 text-[0.72rem] font-semibold text-[#5b4600]" aria-label={`${badge} pendientes`}>{badge}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileNav({ header, footer, badges }: { header: React.ReactNode; footer: React.ReactNode; badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-md text-white hover:bg-white/10">
        <Menu className="size-5" strokeWidth={1.75} />
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-label="Menú principal"
        className="m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none bg-brand-ink p-0 text-white backdrop:bg-black/45">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 px-4 pt-3">
            <div className="min-w-0">{header}</div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú"
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-white/10">
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>
          <nav className="mt-4 flex-1 overflow-y-auto px-3" aria-label="Principal">
            <NavLinks onNavigate={() => setOpen(false)} badges={badges} />
          </nav>
          <div className="border-t border-white/10 p-3">{footer}</div>
        </div>
      </dialog>
    </>
  );
}
