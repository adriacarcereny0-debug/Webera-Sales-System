"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const forbidden = error.name === "ForbiddenError" || /permiso/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{forbidden ? "No tienes permiso para esta acción" : "Algo no ha ido bien"}</h1>
      <p className="mt-2 text-muted">{forbidden ? "Pide a un administrador de tu empresa que revise tu rol." : "No se ha guardado nada a medias. Vuelve a intentarlo; si se repite, avisa a soporte indicando este código."}</p>
      {error.digest && !forbidden && <p className="mt-3 font-mono text-[0.8rem] text-faint">Código: {error.digest}</p>}
      <Button variant="primary" className="mt-6" onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
