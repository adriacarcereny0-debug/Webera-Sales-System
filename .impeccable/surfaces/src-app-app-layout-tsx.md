---
version: 1
slug: "src-app-app-layout-tsx"
primary_target: "src/app/(app)/layout.tsx"
related_targets: ["src/app/(app)/panel/page.tsx","src/app/(app)/contactos/[id]/page.tsx","src/app/f/[slug]/page.tsx"]
---

# Surface brief: aplicación (panel de trabajo)

Scope: toda la aplicación autenticada (panel, contactos, pipeline, presupuestos, agenda, automatizaciones, ajustes) y el formulario público. Mode: Operate.

Audience and job: propietarios y oficina de pequeñas instaladoras de climatización, aerotermia y solar; registrar solicitudes, mover oportunidades, preparar presupuestos revisados y no olvidar seguimientos. Uso diario en oficina (luz de día) y en móvil en obra.

Constraints: controles web estándar; color de acento por empresa (--brand) sustituye a la tinta azul por defecto; sin emojis; sin cifras inventadas.

## Direction contract

THESIS: La aplicación es el talonario de albaranes del instalador hecho software: cada solicitud tiene su número de folio rojo y su copia de color por fase. Rechaza el panel SaaS gris genérico de tarjetas iguales.

OWN-WORLD: Barra lateral en tinta azul de bolígrafo (mezcla del color de marca con tinta oscura), papel blanco frío #f5f6f8 con hojas blancas, folios en rojo numeradora #c22d29 con cifras estrechas (Archivo, anchura 72 %), estados con los tintes de las copias autocopiativas (blanca, amarilla, azul, rosa, oro, verde, gris), trepado punteado entre matriz y hoja.

STORY: El empresario ve de un vistazo qué ha entrado, qué espera respuesta y qué está vencido; abre un contacto, lo mueve de fase, prepara el presupuesto, lo revisa y lo envía.

FIRST VIEWPORT: Panel: saludo y acciones rápidas arriba a la derecha (Nuevo contacto en primario); tira de seis indicadores separados por trepado; franja amarilla «Requiere atención»; debajo, dos gráficos de una serie (solicitudes y ventas por mes).

FORM: Talonario de albaranes, posición 4 de la lista propia (asignada por la tirada). seed: none (unavailable). Gesto distintivo: folio rojo numerado en cada registro y ficha de contacto como matriz | trepado | hoja.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
