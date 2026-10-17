import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/misc";
import { STAGE_META, STAGES } from "@/lib/stages";
import { Chip } from "@/components/ui/chip";

export const metadata: Metadata = { title: "Manual de uso" };

const SECTIONS = [
  ["inicio", "Primeros pasos"],
  ["contactos", "Cómo entra un contacto"],
  ["fases", "Organizar oportunidades"],
  ["presupuestos", "Presupuestos"],
  ["agenda", "Visitas y tareas"],
  ["automatizaciones", "Automatizaciones"],
  ["formulario", "Formulario web"],
  ["datos", "Importar, exportar y copias"],
  ["equipo", "Usuarios y permisos"],
  ["demo", "Demostración en 5 minutos"],
] as const;

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-12 scroll-mt-6 text-[1.25rem] font-semibold tracking-[-0.01em] text-ink first:mt-0">{children}</h2>;
}

export default async function HelpPage() {
  await requireSession();
  return (
    <>
      <PageHeader title="Manual de uso" description="Todo lo necesario para trabajar con el sistema en el día a día, explicado sin tecnicismos." />
      <div className="grid-cols-1 grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Índice del manual" className="lg:sticky lg:top-6">
          <ol className="space-y-1 text-[0.88rem]">
            {SECTIONS.map(([id, label], i) => (
              <li key={id}><a href={`#${id}`} className="flex gap-2 rounded px-2 py-1.5 text-ink-2 hover:bg-sheet hover:text-ink"><span className="num w-4 text-faint">{i + 1}</span>{label}</a></li>
            ))}
          </ol>
        </nav>
        <article className="max-w-[70ch] rounded-lg bg-sheet px-5 py-7 text-[0.97rem] leading-[1.7] text-ink-2 shadow-sheet ring-1 ring-rule md:px-10 md:py-10 [&_p]:mt-3 [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-ink [&_a]:text-brand [&_a]:underline">
          <H id="inicio">Primeros pasos</H>
          <p>El sistema reúne en un único sitio las solicitudes de clientes, los presupuestos, las visitas y el seguimiento. Cada contacto recibe un <strong>número de folio</strong> (en rojo, como en un talonario) que no se repite: úsalo para localizarlo rápido.</p>
          <ol>
            <li>En <Link href="/ajustes">Ajustes</Link> completa la <strong>puesta en marcha</strong>: datos de la empresa, logotipo, color, servicios y equipo.</li>
            <li>Pega el <Link href="/ajustes/formulario">formulario web</Link> en tu página de contacto.</li>
            <li>Conecta tu <Link href="/ajustes/correo">correo de envío</Link> (1 minuto con Gmail) para que los avisos y las respuestas a clientes salgan solos. Las <Link href="/automatizaciones">automatizaciones</Link> ya vienen activadas.</li>
            <li>Cada mañana, abre el <Link href="/panel">Panel</Link>: verás lo que requiere atención, las visitas del día y las cifras reales.</li>
          </ol>

          <H id="contactos">Cómo entra un contacto</H>
          <ul>
            <li><strong>Desde tu web:</strong> el formulario crea el contacto con su folio, guarda el consentimiento de privacidad y avisa por email (si está configurado). El cliente ve en pantalla su número de solicitud.</li>
            <li><strong>Por teléfono, WhatsApp o en tienda:</strong> pulsa <Link href="/contactos/nuevo">Nuevo contacto</Link>. Si el teléfono o el email ya existen, el sistema te avisa para no duplicarlo.</li>
            <li><strong>Desde una hoja de cálculo:</strong> <Link href="/ajustes/datos#importar">importa un CSV</Link>. Antes de importar ves qué filas entran y cuáles se omiten.</li>
          </ul>

          <H id="fases">Organizar oportunidades</H>
          <p>Cada contacto avanza por estas fases. Puedes moverlo desde su ficha o arrastrándolo en el <Link href="/pipeline">Pipeline</Link>; cada cambio queda en su historial.</p>
          <ul className="!list-none !pl-0">
            {STAGES.map((s) => <li key={s} className="flex flex-wrap items-baseline gap-2"><Chip tint={STAGE_META[s].tint}>{STAGE_META[s].label}</Chip><span className="text-[0.9rem]">{STAGE_META[s].hint}</span></li>)}
          </ul>
          <p>La regla de oro: <strong>toda oportunidad abierta debe tener responsable y próxima acción con fecha</strong>. El panel y el listado señalan las que no la tienen o la tienen vencida.</p>

          <H id="presupuestos">Presupuestos</H>
          <ol>
            <li>Desde la ficha del contacto, pulsa <strong>Nuevo presupuesto</strong>. Añade conceptos, cantidades, precios y el tipo de IVA de cada línea. Los totales se calculan solos.</li>
            <li>Se guarda como <strong>borrador</strong>. Un administrador o el propietario lo revisa y pulsa <strong>Dar por revisado</strong>. Sin revisión no se puede marcar como enviado.</li>
            <li>Pulsa <strong>Enviar por email</strong>: el cliente recibe un enlace para verlo en el móvil, descargar el PDF y <strong>aceptarlo con un clic</strong>. Si prefieres WhatsApp, usa <strong>Crear enlace</strong> y pégalo en el chat.</li>
            <li>Cuando el cliente acepta desde el enlace, todo pasa solo: el presupuesto queda aceptado, la ficha pasa a «Ganado», se crea la tarea «Planificar la instalación» y te avisamos por email. Si contesta por teléfono, márcalo tú con <strong>Aceptado</strong> o <strong>Rechazado</strong>.</li>
          </ol>
          <p>Para reutilizar un presupuesto parecido, usa <strong>Duplicar como plantilla</strong>. Importante: el sistema hace las cuentas, pero <strong>no decide qué tipo de IVA corresponde</strong> ni valida precios: eso lo determina tu empresa.</p>

          <H id="agenda">Visitas y tareas</H>
          <p>En la ficha de cada contacto puedes programar una <strong>visita técnica</strong> (con fecha, duración y lugar) o una <strong>tarea</strong> (llamar, enviar documentación…). La <Link href="/agenda">Agenda</Link> las ordena: vencidas, hoy, próximos 7 días y más adelante.</p>

          <H id="automatizaciones">Automatizaciones</H>
          <p>Vienen activadas y trabajan solas. Puedes apagar o ajustar cualquiera en <Link href="/automatizaciones">Automatizaciones</Link>.</p>
          <p><strong>Cuando llega una solicitud</strong></p>
          <ul>
            <li><strong>Contestar al cliente:</strong> le llega un correo confirmando que habéis recibido su solicitud, con su número.</li>
            <li><strong>Avisaros:</strong> email inmediato al equipo con los datos del cliente.</li>
            <li><strong>Repartir por turnos:</strong> se asigna a quien menos contactos abiertos tenga, con «Llamar» como próximo paso.</li>
            <li><strong>Juntar repetidos:</strong> si el cliente ya estaba en tu lista, se añade a su ficha en vez de duplicarla.</li>
            <li><strong>Tarea si nadie ha llamado:</strong> pasado el plazo, se crea la tarea de llamada.</li>
          </ul>
          <p><strong>Mientras se trabaja la venta</strong></p>
          <ul>
            <li><strong>Fases solas:</strong> visita programada → «Visita programada»; presupuesto enviado → «Presupuesto enviado»; aceptado → «Ganado»; rechazado → «Perdido».</li>
            <li><strong>Después de la visita:</strong> al marcarla como hecha, se crea «Preparar presupuesto» para el día siguiente.</li>
            <li><strong>Presupuestos caducados:</strong> pasada la fecha de validez sin respuesta, se marcan como caducados y se crea una tarea para llamar.</li>
          </ul>
          <p><strong>Recordatorios y avisos</strong></p>
          <ul>
            <li><strong>Visita:</strong> recordatorio al técnico y al cliente el día antes.</li>
            <li><strong>Presupuesto sin respuesta:</strong> tarea y aviso al responsable; opcionalmente, un correo amable al cliente con el enlace.</li>
            <li><strong>Resumen del día:</strong> cada mañana, cada persona recibe sus visitas, tareas y lo pendiente.</li>
          </ul>
          <p>Se comprueban solas cada 15 minutos mientras alguien usa la aplicación, y una vez al día aunque nadie entre. Ninguna acción se repite para el mismo caso y todo queda registrado, incluidos los emails y su estado. «Aceptado por el proveedor» significa que tu correo lo ha admitido; no garantiza que haya llegado al buzón.</p>

          <H id="formulario">Formulario web</H>
          <p>Tiene protección contra spam (campo oculto, tiempo mínimo y límite de envíos), pide solo los datos imprescindibles e incluye la información de protección de datos con casilla de consentimiento. Revisa ese texto con tu asesoría y enlaza tu política de privacidad desde <Link href="/ajustes/formulario">Ajustes › Formulario web</Link>.</p>

          <H id="datos">Importar, exportar y copias</H>
          <p>Desde <Link href="/ajustes/datos">Ajustes › Importar, exportar y demo</Link> puedes descargar contactos y presupuestos en CSV (se abre en Excel) y, si eres propietario, una copia completa en JSON. Las copias de seguridad automáticas de la base de datos dependen del proveedor contratado; Webora Studio te indicará cuál está activa.</p>

          <H id="equipo">Usuarios y permisos</H>
          <p>Cada persona entra con su email. Hay cuatro roles: <strong>Propietario</strong> (todo), <strong>Administrador</strong> (todo salvo usuarios), <strong>Comercial</strong> (contactos, tareas y presupuestos, sin revisar ni configurar) y <strong>Solo lectura</strong>. Los datos de tu empresa son inaccesibles para cualquier otra empresa que use el sistema.</p>

          <H id="demo">Demostración en 5 minutos</H>
          <p>Guion para enseñar el producto con la empresa ficticia de demostración:</p>
          <ol>
            <li><strong>Entra un contacto (1 min).</strong> Abre el <Link href="/ajustes/formulario">formulario web</Link> en otra pestaña, rellénalo y envíalo: aparece el número de solicitud. Vuelve al Panel: el contacto ya está en «Requiere atención».</li>
            <li><strong>Se organiza la oportunidad (1 min).</strong> Abre el contacto, asígnale responsable, anota la llamada y muévelo a «Pendiente de contactar». Enseña el historial de fases.</li>
            <li><strong>Se crea un presupuesto (1,5 min).</strong> «Nuevo presupuesto», añade dos líneas, guarda, da por revisado y descarga el PDF con el logotipo.</li>
            <li><strong>Se programa el seguimiento (0,5 min).</strong> En la ficha, programa una visita técnica para mañana. Aparece en la Agenda y en el Panel.</li>
            <li><strong>Se ven los resultados (1 min).</strong> Panel: solicitudes por mes, ventas aceptadas, valor por fase y conversión. Termina en el Pipeline arrastrando una tarjeta.</li>
          </ol>
          <p>Al terminar, <Link href="/ajustes/datos#demo">restaura la demo</Link> para dejarla como estaba. Todos los datos de la demo son ficticios y así se indica en pantalla.</p>
        </article>
      </div>
    </>
  );
}
