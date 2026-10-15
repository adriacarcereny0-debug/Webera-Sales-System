import { describe, expect, it } from "vitest";
import { csvCell, decodeCsvBytes, detectDelimiter, mapHeaders, parseCsv, toCsv } from "@/lib/csv";

describe("CSV", () => {
  it("detecta punto y coma de Excel en español", () => {
    expect(detectDelimiter("Nombre;Teléfono;Email\nAna;600;a@b.es")).toBe(";");
    expect(detectDelimiter("name,phone\nA,1")).toBe(",");
  });
  it("parsea comillas, separadores y saltos de línea dentro de campos", () => {
    const rows = parseCsv('Nombre;Notas\r\n"Pérez; Ana";"Dice ""hola""\nsegunda línea"\r\n\r\nLuis;', ";");
    expect(rows).toEqual([["Nombre", "Notas"], ["Pérez; Ana", 'Dice "hola"\nsegunda línea'], ["Luis", ""]]);
  });
  it("decodifica Windows-1252 cuando no es UTF-8", () => {
    const latin1 = new Uint8Array([0x50, 0xe9, 0x72, 0x65, 0x7a]); // "Pérez" en Windows-1252
    expect(decodeCsvBytes(latin1)).toBe("Pérez");
    expect(decodeCsvBytes(new TextEncoder().encode("﻿Pérez"))).toBe("Pérez");
  });
  it("reconoce cabeceras en español con acentos y variantes", () => {
    expect(mapHeaders(["Nombre y apellidos", "Teléfono móvil", "Correo electrónico", "C.P.", "Población"])).toEqual({
      name: 0, phone: 1, email: 2, postal_code: 3, city: 4,
    });
  });
  it("neutraliza fórmulas al exportar", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+34 600")).toBe("'+34 600");
    expect(toCsv(["a"], [["b;c"]])).toBe("﻿a\r\n\"b;c\"\r\n");
  });
});
