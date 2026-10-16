import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight, BellRing, CalendarCheck, FileCheck2, Inbox, MailCheck, MapPin, MousePointerClick, Repeat2, ShieldCheck, Smartphone, Sunrise, UsersRound,
} from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { issueFormToken } from "@/lib/form-token";
import { env } from "@/lib/env";
import { WeberaWordmark } from "@/components/brand/webera-mark";
import { buttonClass } from "@/components/ui/button";
import { StoryDeck } from "@/app/login/deck";
import { DemoForm } from "@/components/landing/demo-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Webera · El sistema comercial para instaladores de climatización y placas solares" },
  description:
    "Recibe las solicitudes de tu web, contesta al cliente al momento, reparte el trabajo y envía presupuestos que se aceptan desde el móvil. Para instaladores de aire acondicionado, aerotermia y placas solares.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Webera Sales System",
    description: "Que ninguna solicitud se quede en el cajón. El sistema comercial para empresas instaladoras.",
    type: "website",
    locale: "es_ES",
    images: [{ url: "/landing/panel.webp", width: 2000, height: 1250, alt: "Panel de Webera Sales System con datos de ejemplo" }],
  },
};

const AUTOMATIC = [
  { icon: MailCheck, title: "Contesta al cliente al momento", text: "Quien rellena tu formulario recibe un correo de tu empresa con su número de solicitud. Sabe que le has leído." },
  { icon: UsersRound, title: "Reparte el trabajo", text: "Cada solicitud se asigna a la persona con menos trabajo, con «Llamar» como siguiente paso." },
  { icon: Repeat2, title: "Sin fichas repetidas", text: "Si un cliente vuelve a escribir, se añade a su ficha. Nadie le llama dos veces." },
  { icon: CalendarCheck, title: "Recuerda las visitas", text: "El técnico y el cliente reciben un aviso el día antes, con la dirección y la hora." },
  { icon: FileCheck2, title: "Presupuesto que se acepta con un clic", text: "El cliente lo abre en el móvil, lo descarga en PDF y lo acepta. Tú te enteras al instante." },
  { icon: BellRing, title: "Nada se queda parado", text: "Si un presupuesto no tiene respuesta o un contacto no se ha llamado, se crea la tarea y se avisa." },
  { icon: Sunrise, title: "Tu día, cada mañana", text: "Cada persona recibe sus visitas, sus tareas y lo que tiene atrasado. Si no hay nada, no molesta." },
  { icon: Inbox, title: "Todo en un sitio", text: "Contactos, visitas, presupuestos y cifras reales: cuánto vendes y de dónde llegan tus clientes." },
];

const STEPS = [
  { n: "01", title: "Te damos de alta", text: "Creamos tu cuenta con tus servicios, tu logo y tus colores. Te ayudamos a conectar tu correo." },
  { n: "02", title: "Pones el formulario en tu web", text: "Pegas un código en tu página de contacto o compartes el enlace en Google, redes o WhatsApp." },
  { n: "03", title: "El sistema trabaja contigo", text: "Las solicitudes entran solas, se contestan, se reparten y avanzan hasta el presupuesto aceptado." },
];

const FAQ = [
  { q: "¿Tengo que cambiar mi página web?", a: "No. Pegas un pequeño código en tu página de contacto (funciona con WordPress y similares) o, si no tienes web, compartes el enlace del formulario." },
  { q: "¿Mis clientes tienen que instalar algo?", a: "No. Reciben correos normales y abren el presupuesto en el navegador del móvil o del ordenador." },
  { q: "¿Desde qué correo salen los avisos?", a: "Desde el tuyo: conectas tu Gmail o el correo de tu dominio en un minuto, y los clientes ven tu nombre y tu dirección." },
  { q: "¿Dónde están mis datos?", a: "En servidores de la Unión Europea (Fráncfort). Los datos de cada empresa están separados de los de las demás y las contraseñas de correo se guardan cifradas." },
  { q: "¿Funciona en el móvil?", a: "Sí, la aplicación se adapta a cualquier pantalla, y el presupuesto online está pensado para abrirse desde el móvil." },
  { q: "¿Cuánto cuesta?", a: "Depende de cuántas personas sois. Te lo explicamos en la demostración, sin compromiso." },
];

function Shot({ src, alt, w, h, className, priority }: { src: string; alt: string; w: number; h: number; className?: string; priority?: boolean }) {
  return (
    <figure className={className}>
      <div className="overflow-hidden rounded-lg bg-sheet shadow-[0_30px_70px_-30px_rgb(12_18_41/0.45)] ring-1 ring-rule">
        <Image src={src} alt={alt} width={w} height={h} sizes="(min-width: 1024px) 60vw, 100vw" className="h-auto w-full" priority={priority} />
      </div>
      <figcaption className="mt-2 text-[0.78rem] text-muted">Captura real con datos de ejemplo.</figcaption>
    </figure>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ utm_source?: string; ref?: string }> }) {
  if (await getSession()) redirect("/panel");
  const sp = await searchParams;
  const source = (sp.utm_source || sp.ref || "").slice(0, 100);
  const token = issueFormToken("webera-demo");

  return (
    <div className="bg-paper text-ink">
      <a href="#demo" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-sheet focus:px-3 focus:py-2">Ir al formulario</a>

      <header className="sticky top-0 z-30 border-b border-rule bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" aria-label="Webera, inicio"><WeberaWordmark sub="Sales System" /></Link>
          <nav aria-label="Principal" className="flex items-center gap-1 text-[0.9rem]">
            <a href="#como-funciona" className="hidden rounded-md px-3 py-2 text-ink-2 hover:text-ink md:inline">Cómo funciona</a>
            <a href="#que-hace" className="hidden rounded-md px-3 py-2 text-ink-2 hover:text-ink md:inline">Qué hace solo</a>
            <a href="#preguntas" className="hidden rounded-md px-3 py-2 text-ink-2 hover:text-ink md:inline">Preguntas</a>
            <Link href="/login" className="rounded-md px-3 py-2 text-ink-2 hover:text-ink">Acceder</Link>
            <a href="#demo" className={buttonClass("primary", "md", "ml-1")}>Pedir demo</a>
          </nav>
        </div>
      </header>

      <main>
        {/* Portada */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 md:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20 lg:pb-24">
          <div>
            <p className="text-[0.9rem] font-medium text-brand">Para instaladores de aire acondicionado, aerotermia y placas solares</p>
            <h1 className="mt-3 text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-[3.2rem]">
              Que ninguna solicitud se quede en el cajón.
            </h1>
            <p className="mt-5 max-w-xl text-[1.1rem] leading-relaxed text-ink-2 text-pretty">
              Webera recibe las solicitudes de tu web, contesta al cliente al momento, reparte el trabajo entre tu equipo y envía presupuestos que tus clientes aceptan desde el móvil.
              Tú te dedicas a instalar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#demo" className={buttonClass("primary", "md", "h-12 px-5 text-[1rem]")}>Pedir una demostración<ArrowRight className="size-4" strokeWidth={2} aria-hidden /></a>
              <a href="#como-funciona" className={buttonClass("secondary", "md", "h-12 px-5 text-[1rem]")}>Ver cómo funciona</a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.88rem] text-ink-2">
              <li className="inline-flex items-center gap-2"><MousePointerClick className="size-4 text-brand" strokeWidth={1.75} aria-hidden />Funciona con tu web actual</li>
              <li className="inline-flex items-center gap-2"><Smartphone className="size-4 text-brand" strokeWidth={1.75} aria-hidden />Desde el móvil o el ordenador</li>
              <li className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-brand" strokeWidth={1.75} aria-hidden />Datos en la Unión Europea</li>
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-brand-ink px-6 py-10 text-white sm:px-10">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1.3px)", backgroundSize: "18px 18px" }} />
            <p className="relative mb-6 text-[0.85rem] font-medium text-white/60">Así viaja un cliente, en 5 pasos. Pulsa la ficha.</p>
            <div className="relative"><StoryDeck /></div>
          </div>
        </section>

        {/* Problema */}
        <section className="border-y border-rule bg-sheet">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-14 md:grid-cols-3 md:px-6">
            {[
              ["Solicitudes que nadie contesta", "Llegan por la web, el teléfono y WhatsApp, y alguna se pierde por el camino. Cada una es un cliente que se va a la competencia."],
              ["Presupuestos que se enfrían", "Se envían en PDF y nadie vuelve a llamar. Pasan las semanas y el cliente ya ha contratado a otro."],
              ["Nadie sabe qué está pendiente", "Las visitas están en una libreta, los presupuestos en el correo y lo urgente, en la cabeza de alguien."],
            ].map(([t, x]) => (
              <div key={t}>
                <p className="text-[1.05rem] font-semibold text-ink">{t}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{x}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-6">
          <h2 className="max-w-2xl text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Empezar es fácil: en un par de días está funcionando.</h2>
          <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="border-t-2 border-ink pt-4">
                <p className="folio text-[1.1rem]">{s.n}</p>
                <p className="mt-2 text-[1.1rem] font-semibold">{s.title}</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <Shot src="/landing/panel.webp" alt="Panel con las solicitudes del mes, presupuestos pendientes, ventas y lo que requiere atención" w={2000} h={1250} className="mt-14" />
        </section>

        {/* Qué hace solo */}
        <section id="que-hace" className="scroll-mt-20 bg-brand-ink text-white">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2 className="max-w-2xl text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Lo que hace solo, sin que nadie se acuerde.</h2>
            <p className="mt-3 max-w-2xl text-[1.02rem] text-white/70">Vienen activadas desde el primer día. Puedes apagar o ajustar cualquiera.</p>
            <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {AUTOMATIC.map((a) => (
                <li key={a.title}>
                  <a.icon className="size-6 text-white/85" strokeWidth={1.6} aria-hidden />
                  <p className="mt-3 font-semibold">{a.title}</p>
                  <p className="mt-1.5 text-[0.92rem] leading-relaxed text-white/65">{a.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Presupuesto online */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 md:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h2 className="max-w-xl text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Tu cliente acepta el presupuesto desde el sofá.</h2>
            <p className="mt-4 max-w-xl text-[1.02rem] leading-relaxed text-ink-2">
              Pulsas «Enviar por email» y le llega un enlace. Lo ve en el móvil con tu logo, lo descarga en PDF y pulsa «Aceptar».
              En ese momento la ficha pasa a «Ganado», se crea la tarea de planificar la instalación y te llega un aviso.
            </p>
            <ul className="mt-6 space-y-2 text-[0.95rem] text-ink-2">
              <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-folio" aria-hidden />Si prefieres WhatsApp, copias el enlace y lo pegas en el chat.</li>
              <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-folio" aria-hidden />Ves cuándo lo ha abierto.</li>
              <li className="flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-folio" aria-hidden />Si no contesta, el sistema te lo recuerda; y si caduca, se marca solo.</li>
            </ul>
          </div>
          <Shot src="/landing/presupuesto-movil.webp" alt="Presupuesto abierto en el móvil con el botón Aceptar presupuesto" w={780} h={1688} className="mx-auto w-full max-w-[20rem]" />
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6">
          <h2 className="max-w-2xl text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Cada cliente, en su sitio.</h2>
          <p className="mt-3 max-w-2xl text-[1.02rem] text-ink-2">Desde «Nuevo contacto» hasta «Ganado», con su responsable, su próximo paso y su importe. De un vistazo sabes qué toca hoy.</p>
          <Shot src="/landing/pipeline.webp" alt="Tablero con los contactos por fase: nuevo, pendiente de contactar, visita programada y presupuesto enviado" w={2000} h={1250} className="mt-10" />
        </section>

        {/* Preguntas */}
        <section id="preguntas" className="scroll-mt-20 border-t border-rule bg-sheet">
          <div className="mx-auto max-w-3xl px-4 py-20 md:px-6">
            <h2 className="text-[2rem] leading-tight font-semibold tracking-[-0.02em]">Preguntas frecuentes</h2>
            <div className="mt-8 divide-y divide-rule border-y border-rule">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.02rem] font-medium text-ink">
                    {f.q}
                    <span aria-hidden className="text-[1.3rem] leading-none text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Formulario */}
        <section id="demo" className="scroll-mt-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-20 md:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-balance">Pide una demostración.</h2>
              <p className="mt-4 text-[1.02rem] leading-relaxed text-ink-2">
                Te enseñamos Webera con ejemplos de tu trabajo: cómo entra una solicitud, cómo sale un presupuesto y qué ves cada mañana. Sin compromiso.
              </p>
              <ul className="mt-6 space-y-3 text-[0.95rem] text-ink-2">
                <li className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />Pensado para empresas instaladoras en España.</li>
                <li className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />Datos alojados en la Unión Europea, separados por empresa.</li>
              </ul>
            </div>
            <div className="relative rounded-xl bg-sheet p-5 shadow-sheet ring-1 ring-rule sm:p-8">
              <DemoForm token={token} source={source} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[0.85rem] text-muted md:px-6">
          <WeberaWordmark sub="Sales System" />
          <div className="flex flex-wrap gap-5">
            <a href="#demo" className="hover:text-ink">Pedir demo</a>
            <Link href="/login" className="hover:text-ink">Acceso clientes</Link>
          </div>
          <p className="w-full text-[0.78rem] text-faint">© {new Date().getFullYear()} Webera · {env.appUrl.replace(/^https?:\/\//, "")}</p>
        </div>
      </footer>
    </div>
  );
}
