"use client";
import { useState } from "react";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Elegir entre contraseña generada (recomendado) o escrita a mano, y si debe cambiarse al entrar. */
export function PasswordFields({ idPrefix, error, defaultMustChange = true }: { idPrefix: string; error?: string; defaultMustChange?: boolean }) {
  const [mode, setMode] = useState<"generar" | "manual">("generar");
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1.5 text-[0.82rem] font-medium text-ink-2">Contraseña</legend>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-paper p-1 ring-1 ring-inset ring-rule">
          {(["generar", "manual"] as const).map((m) => (
            <label key={m} className={cn("flex h-9 cursor-pointer items-center justify-center rounded text-[0.84rem]", mode === m ? "bg-sheet font-semibold text-ink shadow-sheet" : "text-muted hover:text-ink")}>
              <input type="radio" name="password_mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
              {m === "generar" ? "Generar segura" : "Escribirla yo"}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "manual" && (
        <Field label="Nueva contraseña" htmlFor={`${idPrefix}-pw`} error={error} hint="Mínimo 10 caracteres, con letras y números.">
          <Input id={`${idPrefix}-pw`} name="password" type="text" autoComplete="off" spellCheck={false} className="font-mono" />
        </Field>
      )}
      <Checkbox name="must_change" defaultChecked={defaultMustChange} label="Pedir que la cambie en el primer acceso" />
    </div>
  );
}
