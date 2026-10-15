"use client";
import { useRef } from "react";

/** Formulario GET que se envía solo al cambiar un select (con botón de respaldo sin JS). */
export function AutoSubmitForm({ children, className, action }: { children: React.ReactNode; className?: string; action?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} method="get" action={action} className={className} role="search"
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT") ref.current?.requestSubmit();
      }}>
      {children}
    </form>
  );
}
