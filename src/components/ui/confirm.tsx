"use client";
import { useRef, type ReactNode } from "react";
import { Button, buttonClass, type ButtonVariant } from "./button";

/**
 * Botón con confirmación en <dialog> nativo (gestiona foco y Escape).
 * Envía el formulario indicado por `action` con los campos ocultos dados.
 */
export function ConfirmAction({
  label, title, children, confirmLabel = "Confirmar", action, fields = {}, variant = "secondary", confirmVariant = "danger", size,
  className,
}: {
  label: ReactNode; title: string; children?: ReactNode; confirmLabel?: string;
  action: (fd: FormData) => void | Promise<void>; fields?: Record<string, string>;
  variant?: ButtonVariant; confirmVariant?: ButtonVariant; size?: "sm" | "md"; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => ref.current?.showModal()}>{label}</Button>
      <dialog ref={ref} aria-labelledby="confirm-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-sheet p-0 text-ink shadow-lift ring-1 ring-rule backdrop:bg-[rgb(12_18_41/0.45)]">
        <form action={action} className="p-5">
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <h2 id="confirm-title" className="text-base font-semibold">{title}</h2>
          {children && <div className="mt-2 text-sm text-muted text-pretty">{children}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()} autoFocus>Cancelar</button>
            <button type="submit" className={buttonClass(confirmVariant)} onClick={() => setTimeout(() => ref.current?.close(), 0)}>{confirmLabel}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
