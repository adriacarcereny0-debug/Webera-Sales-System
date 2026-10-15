"use client";
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center", color: "#151b2c" }}>
        <h1>No se ha podido cargar la aplicación</h1>
        <p>Inténtalo de nuevo en unos segundos.</p>
        <button onClick={() => reset()} style={{ marginTop: 16, padding: "10px 16px" }}>Reintentar</button>
      </body>
    </html>
  );
}
