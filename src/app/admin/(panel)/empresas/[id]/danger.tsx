"use client";
import { useRef, useState } from "react";
import { deleteCompany } from "../../../actions";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function DeleteCompany({ id, slug, name }: { id: string; slug: string; name: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  return (
    <>
      <button type="button" className={buttonClass("danger")} onClick={() => ref.current?.showModal()}>Eliminar empresa</button>
      <dialog ref={ref} aria-labelledby="del-title" className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg bg-sheet p-0 text-ink shadow-lift ring-1 ring-rule backdrop:bg-[rgb(12_18_41/0.55)]">
        <form action={deleteCompany} className="space-y-4 p-5">
          <input type="hidden" name="id" value={id} />
          <h2 id="del-title" className="font-semibold">¿Eliminar «{name}» definitivamente?</h2>
          <p className="text-sm text-muted">Se borran sus usuarios, contactos, presupuestos, tareas, fotos y registros. No se puede deshacer. Si solo quieres cortar el acceso, suspende la cuenta.</p>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-[0.82rem] font-medium text-ink-2">Escribe <span className="font-mono text-danger">{slug}</span> para confirmar</label>
            <Input id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="font-mono" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass("secondary")} onClick={() => ref.current?.close()}>Cancelar</button>
            <button type="submit" disabled={typed !== slug} className={buttonClass("danger")}>Eliminar para siempre</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
