import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["@react-pdf/renderer", "pg", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [
      {
        // Aplicación interna: no se puede incrustar en otras webs.
        source: "/((?!f/).*)",
        headers: [...securityHeaders, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }],
      },
      {
        // Formulario público: diseñado para incrustarse en la web de cada instalador.
        source: "/f/:path*",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
