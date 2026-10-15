/** CSV mínimo y robusto (RFC 4180) con detección de separador para Excel en español. */

export function decodeCsvBytes(bytes: Uint8Array): string {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  // Excel en Windows suele guardar en Windows-1252: si aparecen caracteres de sustitución, reinterpretamos.
  if (text.includes("�")) text = new TextDecoder("windows-1252").decode(bytes);
  return text.replace(/^﻿/, "");
}

export function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 } as Record<string, number>;
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
  }
  const best = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ",") as "," | ";" | "\t";
  return counts[best] > 0 ? best : ",";
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Celda segura para Excel: neutraliza fórmulas (=, +, -, @) y escapa comillas. */
export function csvCell(value: unknown, delimiter = ";"): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (s.includes('"') || s.includes(delimiter) || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][], delimiter = ";"): string {
  return "﻿" + [header, ...rows].map((r) => r.map((c) => csvCell(c, delimiter)).join(delimiter)).join("\r\n") + "\r\n";
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Columnas reconocidas al importar contactos (en minúsculas y sin acentos). */
export const IMPORT_COLUMNS: Record<string, string[]> = {
  name: ["nombre", "nombreyapellidos", "nombrecompleto", "cliente", "contacto", "name"],
  company_name: ["empresa", "razonsocial", "company"],
  phone: ["telefono", "tel", "movil", "telefonomovil", "phone", "telefono1"],
  email: ["email", "correo", "correoelectronico", "mail", "e-mail"],
  address: ["direccion", "domicilio", "address"],
  city: ["localidad", "poblacion", "municipio", "ciudad", "city"],
  postal_code: ["cp", "codigopostal", "postal", "zip"],
  service: ["instalacion", "tipodeinstalacion", "servicio", "producto"],
  estimated_amount: ["importe", "importeestimado", "valor", "presupuesto", "amount"],
  description: ["notas", "descripcion", "observaciones", "comentarios", "notes"],
  created_at: ["fecha", "fechaentrada", "fechadealta", "alta"],
};

export function mapHeaders(header: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, aliases] of Object.entries(IMPORT_COLUMNS)) {
      if (out[key] === undefined && aliases.map(norm).includes(n)) out[key] = i;
    }
  });
  return out;
}
