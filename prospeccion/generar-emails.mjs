#!/usr/bin/env node
/**
 * Convierte la exportación de Apify (Google Maps Scraper, JSON o CSV) en un email personalizado por instalador.
 *
 *   node generar-emails.mjs datos/apify.json --nombre "Adrià" --telefono "600 000 000" [--max 200] [--sin-publicidad]
 *
 * Salida en datos/: emails.csv (para combinar correspondencia o crear borradores) y emails-vista.md (para revisarlos).
 * Solo usa datos reales de cada ficha (nombre, ciudad, categoría, reseñas): no inventa nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const WITH_VALUE = new Set(["--nombre", "--telefono", "--max", "--web", "--excluir", "--salida"]);
const input = args.find((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1]));
if (!input) { console.error("Uso: node generar-emails.mjs <exportación de Apify .json|.csv> --nombre <tu nombre> --telefono <tu teléfono>"); process.exit(1); }
const NOMBRE = opt("nombre", "[tu nombre]");
const TELEFONO = opt("telefono", "[tu teléfono]");
const MAX = Number(opt("max", "200"));
const WEB = opt("web", "https://weborastudio.es").replace(/\/$/, "");
const PREFIJO = args.includes("--sin-publicidad") ? "" : "Publicidad: ";
const outDir = join(dirname(input), ".");
const SALIDA = opt("salida", "emails");

// ---------------------------------------------------------------------------
// Lectura (JSON de Apify o CSV exportado desde la consola)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some(Boolean));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
const raw = readFileSync(input, "utf8");
const items = input.endsWith(".csv") ? parseCsv(raw) : JSON.parse(raw);

// En CSV, Apify aplana los arrays: emails/0, emails/1…
const pick = (it, ...keys) => { for (const k of keys) if (it[k] !== undefined && it[k] !== "") return it[k]; return ""; };
const listOf = (it, key) => Array.isArray(it[key]) ? it[key] : Object.keys(it).filter((k) => k.startsWith(`${key}/`)).map((k) => it[k]).filter(Boolean);

const BAD_EMAIL = /(@www\.|@(mysite|yoursite|tusitio|tudominio|yourdomain|ejemplo|miempresa|correo|tuempresa|empresa)\.|^(ejemplo|email|tuemail|usuario)[a-z0-9]*@|@(daikin|mitsubishielectric|mitsubishi|fujitsu|saunierduval|vaillant|ariston|baxi|junkers|bosch|lg|samsung|panasonic|toshiba|carrier|hitachi|haier|ferroli|roca|leroymerlin|habitissimo|cronoshare|instaladores10|endesa|iberdrola|repsol|naturgy|holaluz)\.|\.(png|jpe?g|gif|webp|svg)$|^(no-?reply|noreply|example|test|privacy|privacidad|rgpd|lopd|dpo|abuse|postmaster)@|@(sentry|wixpress|example|domain)\.|\.wixpress\.com$)/i;
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e) && !BAD_EMAIL.test(e);
// Preferimos el email de contacto general frente al de una persona concreta (más adecuado para un primer contacto).
const rankEmail = (e) => (/^(info|contacto|hola|comercial|ventas|oficina|administracion|presupuestos)@/i.test(e) ? 0 : 1);

function service(it) {
  const t = `${pick(it, "categoryName")} ${listOf(it, "categories").join(" ")} ${pick(it, "searchString")} ${pick(it, "title")}`.toLowerCase();
  if (/aerotermia|bomba de calor/.test(t)) return { key: "aerotermia", label: "aerotermia" };
  if (/solar|fotovolt|placas/.test(t)) return { key: "solar", label: "placas solares" };
  if (/aire|climatiz|clima/.test(t)) return { key: "clima", label: "aire acondicionado" };
  return { key: "general", label: "instalaciones" };
}
// Quita las coletillas de SEO de Google Maps: «AVS Aerotermia Bilbao | Instaladores» → «AVS Aerotermia Bilbao».
const cleanName = (s) => s.replace(/\p{Extended_Pictographic}|\uFE0F/gu, "").split(/\s*\|\|?\s*|\s*[※•]\s*|:\s+|\s+[-–—]\s+|\s*\/\/\s*|(?<=\p{L}{4})\.\s+(?=\p{Lu}\p{Ll})/u)[0].replace(/[\s,;:–-]+$/, "").trim();
const blank = (v) => (v == null || v === "null" || v === "undefined" ? "" : String(v).trim());
const searchedCity = (it) => blank(pick(it, "searchString")).replace(/^instalador (aerotermia|aire acondicionado|placas solares)\s*/i, "");
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------
// Selección: con email válido, sin duplicados, pymes primero
// ---------------------------------------------------------------------------
const seenEmail = new Set(), seenDomain = new Set(), seenName = new Set();
// --excluir: emails o dominios ya contactados (uno por línea) para no escribir dos veces a la misma empresa.
for (const line of (opt("excluir") ? readFileSync(opt("excluir"), "utf8").split(/\r?\n/) : [])) {
  const v = line.trim().toLowerCase();
  if (!v || v.startsWith("#")) continue;
  if (v.includes("@")) { seenEmail.add(v); const d = v.split("@")[1]; if (!/^(gmail|hotmail|outlook|yahoo|icloud|live|msn|telefonica)\./.test(d)) seenDomain.add(d); }
  else seenDomain.add(v);
}
const leads = [];
for (const it of items) {
  if (String(pick(it, "permanentlyClosed")).toLowerCase() === "true" || String(pick(it, "temporarilyClosed")).toLowerCase() === "true") continue;
  const name = cleanName(blank(pick(it, "title", "name")));
  const emails = [...listOf(it, "emails"), pick(it, "email")].map((e) => String(e).trim().toLowerCase()).filter(isEmail).sort((a, b) => rankEmail(a) - rankEmail(b));
  if (!name || !emails.length) continue;
  const email = emails[0];
  const domain = email.split("@")[1];
  const free = /^(gmail|hotmail|outlook|yahoo|icloud|live|msn|telefonica)\./.test(domain);
  if (seenEmail.has(email) || (!free && seenDomain.has(domain)) || seenName.has(name.toLowerCase())) continue;
  seenEmail.add(email); if (!free) seenDomain.add(domain); seenName.add(name.toLowerCase());
  const reviews = Number(pick(it, "reviewsCount")) || 0;
  const score = Number(pick(it, "totalScore")) || 0;
  leads.push({
    name, email, city: blank(pick(it, "city")) || searchedCity(it), phone: String(pick(it, "phone", "phoneUnformatted")), website: String(pick(it, "website")),
    reviews, score, service: service(it), maps: String(pick(it, "url")),
    // Las grandes cadenas (cientos de reseñas) rara vez deciden por un email; las de 5–150 reseñas son el cliente ideal.
    priority: (reviews >= 5 && reviews <= 150 ? 0 : 1) + (pick(it, "website") ? 0 : 0.5) - Math.min(score, 5) / 10,
  });
}
leads.sort((a, b) => a.priority - b.priority);
const chosen = leads.slice(0, MAX);

// ---------------------------------------------------------------------------
// Redacción
// ---------------------------------------------------------------------------
const PAIN = {
  aerotermia: "En aerotermia cada presupuesto lleva su visita, sus mediciones y su seguimiento, y entre obra y obra es fácil que alguna solicitud se quede sin contestar o que un presupuesto se enfríe.",
  solar: "En fotovoltaica el cliente compara dos o tres presupuestos a la vez, y gana quien contesta primero y hace seguimiento sin olvidarse.",
  clima: "Con el aire acondicionado las solicitudes llegan todas de golpe en cuanto aprieta el calor, y en plena temporada es fácil que alguna se quede sin contestar.",
  general: "Entre obra y obra es fácil que alguna solicitud se quede sin contestar o que un presupuesto enviado se enfríe sin que nadie vuelva a llamar.",
};

function compose(l) {
  const where = l.city ? ` en ${l.city}` : "";
  const praise = l.reviews >= 15 && l.score >= 4.5 ? ` Por las ${l.reviews} reseñas que tenéis (${l.score.toFixed(1).replace(".", ",")} de media), se nota que cuidáis a los clientes.` : "";
  const link = `${WEB}/?ref=${encodeURIComponent(`email-${slug(l.name)}`)}#demo`;
  const subject = `${PREFIJO}${l.name}, que ninguna solicitud de ${l.service.label} se quede sin contestar`;
  const body = [
    "Hola:",
    "",
    `Os escribo porque he encontrado ${l.name} al buscar en Google empresas de ${l.service.label}${where}.${praise}`,
    "",
    PAIN[l.service.key],
    "",
    "Hemos hecho Webora Studio justo para eso, pensado para instaladores:",
    "- Las solicitudes de vuestra web entran solas, se le contesta al cliente al momento y se reparten en el equipo.",
    "- Los presupuestos salen en PDF con vuestro logo y el cliente los acepta desde el móvil con un clic.",
    "- Si un presupuesto no tiene respuesta o una visita está cerca, el sistema os lo recuerda.",
    "",
    `¿Os encaja que os lo enseñe en 15 minutos, con ejemplos de vuestro día a día? Podéis pedir la demostración aquí: ${link}`,
    `o contestar a este correo y os llamo. Si lo preferís, mi teléfono es ${TELEFONO}.`,
    "",
    "Un saludo,",
    NOMBRE,
    "Webora Studio",
    "",
    "—",
    `Os escribo a ${l.email} porque es el email de contacto publicado de ${l.name}. Si no queréis recibir más correos de Webora Studio, contestad «baja» y no volveremos a escribiros.`,
  ].join("\n");
  return { ...l, subject, body, link };
}
const emails = chosen.map(compose);

// ---------------------------------------------------------------------------
// Salida
// ---------------------------------------------------------------------------
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const cols = ["email", "empresa", "ciudad", "servicio", "telefono", "web", "resenas", "nota", "asunto", "cuerpo", "enlace", "ficha_google"];
const csv = [cols.join(","), ...emails.map((e) => [e.email, e.name, e.city, e.service.label, e.phone, e.website, e.reviews, e.score, e.subject, e.body, e.link, e.maps].map(esc).join(","))].join("\n");
writeFileSync(join(outDir, `${SALIDA}.csv`), "﻿" + csv);
writeFileSync(join(outDir, `${SALIDA}-vista.md`), emails.map((e, i) => `## ${i + 1}. ${e.name} (${e.city || "sin ciudad"})\n\n**Para:** ${e.email}  \n**Asunto:** ${e.subject}\n\n${e.body}\n`).join("\n---\n\n"));

console.log(`${items.length} fichas leídas · ${leads.length} con email válido y sin duplicados · ${emails.length} emails preparados`);
const by = emails.reduce((m, e) => ((m[e.service.label] = (m[e.service.label] ?? 0) + 1), m), {});
console.log("Por servicio:", by);
if (emails.length < MAX) console.log(`Aviso: solo hay ${emails.length} con email. Sube maxCrawledPlacesPerSearch o añade ciudades en apify-input.json.`);
console.log(`→ ${join(outDir, `${SALIDA}.csv`)}\n→ ${join(outDir, `${SALIDA}-vista.md`)}`);
