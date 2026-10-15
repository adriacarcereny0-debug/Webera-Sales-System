/** Color de texto legible (blanco o tinta) sobre un color de marca. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  // Contraste con blanco vs con tinta (#151b2c, L≈0.011)
  const withWhite = 1.05 / (L + 0.05);
  const withInk = (L + 0.05) / (0.011 + 0.05);
  return withWhite >= withInk ? "#ffffff" : "#151b2c";
}

export function brandStyle(hex: string): React.CSSProperties {
  return { ["--brand" as string]: hex, ["--brand-contrast" as string]: contrastText(hex) } as React.CSSProperties;
}

export function padFolio(n: number | string, width = 6): string {
  return String(n).padStart(width, "0");
}
