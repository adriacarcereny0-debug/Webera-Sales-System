import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/f/", "/api/public/", "/api/cron/", "/fonts/", "/_next/", "/favicon", "/robots.txt"];

/**
 * Filtro rápido: sin cookie de sesión, las rutas privadas redirigen al acceso.
 * La validación real de la sesión (y de permisos) se hace siempre en el servidor
 * en cada página, acción y ruta de API.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  // Panel de plataforma: su propia cookie de sesión.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || req.cookies.get("wss_admin")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!req.cookies.get("wss_session")) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|fonts/).*)"] };
