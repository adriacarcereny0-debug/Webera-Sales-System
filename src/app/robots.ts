import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** Solo la página pública de Webera se indexa; la aplicación, los formularios y los presupuestos no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/$", disallow: ["/"] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
