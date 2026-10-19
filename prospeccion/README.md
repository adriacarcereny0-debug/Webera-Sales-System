# Prospección: 200 instaladores con Apify

1. **Sacar la lista en Apify** (unos minutos)
   - Entra en [apify.com](https://apify.com), abre el actor **Google Maps Scraper** (`compass/crawler-google-places`) y pulsa *Try for free*.
   - En la pestaña *Input*, cambia a **JSON** y pega el contenido de `apify-input.json`: 75 búsquedas (aerotermia, aire acondicionado y placas solares en 25 ciudades), hasta 600 fichas, con la extracción de emails de su web activada.
   - Pulsa **Start**. Al terminar: *Export* → **JSON** y guárdalo como `prospeccion/datos/apify.json`.
   - El coste depende del plan de Apify; revisa el precio por ficha y por enriquecimiento de contactos en la página del actor antes de lanzarlo.

2. **Generar los 200 emails**
   ```bash
   node prospeccion/generar-emails.mjs prospeccion/datos/apify.json --nombre "Tu nombre" --telefono "600 000 000"
   ```
   Crea `datos/emails.csv` (uno por fila: email, empresa, ciudad, asunto, cuerpo, enlace) y `datos/emails-vista.md` para revisarlos.
   Se quedan las fichas con email válido, sin repetidos (mismo email, dominio o nombre), dando prioridad a empresas con 5–150 reseñas.
   Cada email lleva un enlace propio a la demo (`?ref=email-<empresa>`): en /admin › Solicitudes verás qué empresa ha respondido.

3. **Enviar con cuidado**
   - En España la LSSI (art. 20 y 21) exige que un email comercial se identifique como publicidad y, sin consentimiento previo, no permite enviarlo. La AEPD lo aplica también a empresas. Por eso el asunto empieza por «Publicidad:» (se quita con `--sin-publicidad`) y cada email ofrece darse de baja. **Lo más seguro es llamar primero** (el teléfono está en el CSV) y enviar el email a quien diga que sí.
   - Envía poco a poco (20–30 al día) desde un buzón de tu dominio, no todos de golpe: así no acabas en spam.

La carpeta `datos/` está en `.gitignore`: los datos de contacto nunca se suben al repositorio.

## Envío programado (pendiente de acceso a Gmail)
- Datos de origen: dataset de Apify `pv1mnQimZJwUHtCUP` (600 fichas). Si `datos/` se pierde, se recupera con `get-dataset-items` y se regenera igual:
  `node generar-emails.mjs datos/apify.json --nombre "Adria" --telefono "623 41 27 96"`
- Firma: Adria · 623 41 27 96.
- Plan: 200 borradores en Gmail y envío el lunes 19/10/2026 a las 17:00 (Madrid) = 15:00 UTC.

## Segunda tanda (300 empresas, martes 20/10/2026 a las 15:00 Madrid)
1. Apify `compass/crawler-google-places` con `apify-input-2.json` (42 ciudades nuevas × 3 búsquedas, tope 7 $). Guardar en `datos/apify-2.json`.
2. Unir `datos/apify.json` + `datos/apify-2.json` en `datos/apify-todo.json`.
3. `node prospeccion/generar-emails.mjs datos/apify-todo.json --nombre "Adria" --telefono "623 41 27 96" --excluir datos/excluir.txt --max 300 --salida tanda2`
   `excluir.txt` = los 200 del 19/10 (si se pierde, se rehace con los destinatarios de Gmail › Enviados con asunto «Publicidad:»).
4. Enviar cada fila de `datos/tanda2.csv` con Gmail (send_message: to, asunto, cuerpo) y anotar el resultado en `datos/tanda2-enviados.jsonl`.
