---
name: Webera Sales System
description: CRM, presupuestos y seguimiento comercial para empresas instaladoras, con la estética de un talonario de albaranes.
colors:
  brand-ink-blue: "#23408e"
  folio-red: "#c22d29"
  paper: "#f5f6f8"
  sheet: "#ffffff"
  rule: "#e2e5eb"
  rule-strong: "#c9ced8"
  ink: "#151b2c"
  ink-2: "#3b4357"
  muted: "#5a6378"
  faint: "#8a91a2"
  ok: "#1d6b3a"
  warn: "#8a5a00"
  danger: "#b4232a"
  copy-white-fg: "#3a4256"
  copy-yellow-bg: "#fbf1c7"
  copy-yellow-fg: "#654e00"
  copy-blue-bg: "#e4ebfb"
  copy-blue-fg: "#233f87"
  copy-pink-bg: "#fbe3ea"
  copy-pink-fg: "#8a2041"
  copy-gold-bg: "#f8e6c8"
  copy-gold-fg: "#744605"
  copy-green-bg: "#dff1e4"
  copy-green-fg: "#1b5a31"
  copy-grey-bg: "#eceef2"
  copy-grey-fg: "#4a5163"
typography:
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
    lineHeight: 1.4
  folio:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 72"
    fontFeature: "'tnum'"
rounded:
  chip: "4px"
  control: "6px"
  sheet: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-ink-blue}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  chip-stage:
    rounded: "{rounded.chip}"
    height: "24px"
    padding: "0 8px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
---

# Design System: Webera Sales System

## Overview

**Creative North Star: "El talonario del instalador"**

La aplicación traslada al software el talonario de albaranes autocopiativo que cualquier instalador conoce: la estructura en tinta azul de bolígrafo, el número de folio en rojo de numeradora, las copias de colores que indican en qué punto está cada trabajo y el trepado que separa la matriz de la hoja. Es una herramienta de trabajo diario: densa cuando hace falta (tablas, pipeline), sobria siempre, y con la identidad en los detalles, no en la decoración.

El color de marca de cada empresa sustituye a la tinta azul por defecto (barra lateral, botones principales, selección). El rojo de folio y los tintes de copia no se personalizan: son el lenguaje común del producto.

**Key Characteristics:**
- Folio rojo, estrecho y tabular en cada contacto y presupuesto.
- Fases y estados con los tintes de las copias (blanca, amarilla, azul, rosa, oro, verde, gris).
- Ficha de contacto como matriz | trepado | hoja.
- Fondo de papel blanco frío; hojas blancas con regla fina y sombra mínima.

## Colors

Paleta contenida: neutros fríos, una tinta de marca y los tintes de copia con significado.

### Primary
- **Tinta de bolígrafo** (#23408e, `--brand`): barra lateral (mezclada al 42 % con tinta oscura), botón principal, foco, selección, barras de gráficos. Personalizable por empresa; el texto encima se elige automáticamente (blanco o tinta) por contraste.

### Secondary
- **Rojo numeradora** (#c22d29, `--folio`): solo para números de folio y códigos de presupuesto. Nunca para errores (para eso está `danger`).

### Neutral
- **Papel** (#f5f6f8): fondo de la aplicación.
- **Hoja** (#ffffff): superficies de trabajo.
- **Regla / Regla fuerte** (#e2e5eb / #c9ced8): divisiones y bordes de controles.
- **Tinta / Tinta 2 / Apagado / Tenue** (#151b2c / #3b4357 / #5a6378 / #8a91a2): texto principal, secundario, ayudas y marcadores de vacío.

### Named Rules
**La regla de las copias.** Cada fase de oportunidad y estado de presupuesto tiene su tinte de copia fijo (`tint-*` en globals.css: fondo, texto y línea). El color nunca va solo: siempre acompaña a la etiqueta escrita.
**La regla del folio.** El rojo es del número. Si algo rojo no es un folio o un código, es un error.

## Typography

**Fuente:** Archivo (OFL, autoalojada, ejes de peso y anchura), con ui-sans-serif de respaldo.

**Character:** una grotesca de trabajo, legible en tablas, con un eje de anchura que permite las cifras estrechas de numeradora sin traer una segunda familia.

### Hierarchy
- **Headline** (600, 2rem, 1.15, −0.025em): título de página; saludo del panel a 2.25rem.
- **Title** (600, 0.95rem): cabeceras de hoja.
- **Body** (400, 0.875–0.95rem, 1.5): contenido; prosa del manual a 70ch.
- **Label** (500, 0.82rem): etiquetas de campo.
- **Folio** (600, anchura 72 %, cifras tabulares, rojo): números de registro.

### Named Rules
**La regla de las cifras.** Importes y recuentos en cifras tabulares (`.num`); separador de miles siempre visible (9.800 €).

## Layout

Barra lateral fija de 15,5rem en escritorio y tableta; en móvil, barra superior con menú en `<dialog>`. Contenido hasta 84rem con márgenes de 16px (móvil) y 32px (escritorio). Las rejillas de varias columnas declaran `grid-cols-1` en móvil para que el contenido nunca ensanche la página. Formularios largos en secciones de dos columnas (título y ayuda | campos), con barra de acciones fija abajo.

## Elevation & Depth

Casi plano. Las hojas llevan una sombra suave (`--shadow-sheet`) y una regla de 1px; los diálogos y avisos flotantes usan `--shadow-lift`. No hay sombras duras ni efectos de cristal.

## Shapes

Esquinas pequeñas: 4px en chips, 6px en controles, 8px en hojas. El trepado (`.perforation-x/.perforation-y`, puntos de 1,4px cada 9px) separa matriz y hoja, y la cabecera del documento de presupuesto de sus datos.

## Components

### Buttons
- **Forma:** 6px; 44px de alto en móvil, 36px en escritorio.
- **Primario:** fondo de marca, texto por contraste; hover oscurece un 12 %.
- **Secundario / fantasma / discreto / peligro:** hoja con anillo de regla; transparente; texto de marca; rojo de error.
- **Pendiente:** icono giratorio y texto «Guardando…», deshabilitado.

### Chips
- **Estilo:** tinte de copia con línea interior, 24px de alto. Nunca solo color.

### Cards / Containers
- **Hoja:** blanco, 8px, regla y sombra suave; cabecera con título y acciones a la derecha. No se anidan hojas.

### Inputs / Fields
- **Estilo:** anillo de regla fuerte, foco con anillo de marca de 2px, error con anillo rojo y mensaje debajo enlazado por `aria-describedby`.

### Navigation
- **Barra lateral:** dos grupos («Trabajo» y «Gestión») con etiqueta pequeña; enlaces con icono de trazo fino; activo con fondo blanco al 13 % y un punto rojo de folio; contadores en chip amarillo.
- **Barra superior:** buscador global de contactos (atajos «/» y Ctrl/Cmd + K) sobre papel translúcido y fijo.
- **Consola de plataforma (/admin):** cabecera en tinta casi negra (#0c1229) con pestañas subrayadas en rojo de folio, para que nunca se confunda con la app de una empresa.

### Marca Webera
Marca cuadrada en tinta azul con una «W» trazada como firma de bolígrafo y el punto rojo del folio; acompaña al nombre «Webera» en acceso, consola y pie de la barra lateral.

### Folio (componente distintivo)
`Nº 000123` en rojo numeradora, ancho 72 %, tabular. En listados, tablero y fichas; el formulario público lo muestra al cliente como número de solicitud.

## Do's and Don'ts

- **Do** dar a cada oportunidad abierta un responsable y una próxima acción visibles.
- **Do** etiquetar como ficticio todo dato de demostración.
- **Don't** usar etiquetas pequeñas en mayúsculas encima de los títulos (salvo las etiquetas de campo del documento de presupuesto, que reproducen un documento comercial).
- **Don't** usar emojis ni glifos como iconos; solo iconos de trazo fino.
- **Don't** usar el rojo de folio para decorar ni para errores.
