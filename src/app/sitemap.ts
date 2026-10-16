import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${env.appUrl}/`, changeFrequency: "monthly", priority: 1 }];
}
