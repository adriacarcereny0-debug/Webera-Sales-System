"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

/** Buscador global de contactos. Atajos: «/» o Ctrl/Cmd + K. */
export function GlobalSearch() {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form role="search" className="relative w-full max-w-md" onSubmit={(e) => {
      e.preventDefault();
      const q = ref.current?.value.trim() ?? "";
      router.push(q ? `/contactos?q=${encodeURIComponent(q)}` : "/contactos");
    }}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" strokeWidth={1.75} aria-hidden />
      <label htmlFor="global-search" className="sr-only">Buscar contactos</label>
      <input ref={ref} id="global-search" type="search" placeholder="Buscar por nombre, teléfono, email o Nº"
        className="h-10 w-full rounded-lg bg-sheet pr-14 pl-9 text-[0.9rem] text-ink shadow-sheet ring-1 ring-rule transition-shadow placeholder:text-faint hover:ring-rule-strong focus:ring-2 focus:ring-brand focus:outline-none" />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-rule-strong bg-paper px-1.5 py-0.5 font-sans text-[0.7rem] text-muted sm:block">/</kbd>
    </form>
  );
}
