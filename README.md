# Webera Sales System

Sistema comercial para empresas instaladoras de aire acondicionado, climatización, aerotermia y placas solares: recibe solicitudes desde la web, organiza contactos y oportunidades, prepara presupuestos revisados con PDF, programa visitas y tareas, automatiza avisos y muestra resultados reales.

Producto de **Webera**, multiempresa: cada instalador trabaja con su logotipo, colores, servicios y usuarios, y solo accede a sus propios datos.

---

## Estado real del producto

### Terminado y probado
| Área | Qué hay |
|---|---|
| Acceso | Email y contraseña (scrypt), sesiones en cookie `httpOnly`, límite de intentos, contraseña temporal con cambio obligatorio, cierre de otras sesiones al cambiarla. |
| Multiempresa | Políticas RLS de PostgreSQL por empresa + rol de base de datos restringido (`webera_app`) + comprobación de permisos en el servidor. Probado con pruebas de base de datos y de navegador. |
| Roles | Propietario, Administrador, Comercial y Solo lectura, con matriz visible en Ajustes. |
| CRM | Contactos con folio por empresa, búsqueda, filtros (fase, responsable, instalación, origen), orden, paginación, alta y edición, aviso de duplicados, campos personalizados, notas y registro de actividad, próxima acción con vencimientos, historial de fases. |
| Pipeline | Tablero con las 7 fases, arrastrar y soltar, selector «Mover a…» accesible por teclado, motivo obligatorio al perder, valor por columna. |
| Presupuestos | Líneas con cantidad, unidad, precio, descuento e IVA configurable; cálculo en céntimos con desglose por tipo; borrador → **revisión obligatoria** → enviado → aceptado/rechazado/caducado; PDF con logotipo y marca de agua «BORRADOR»; duplicar como plantilla; la fase del contacto se sincroniza. |
| Agenda | Tareas y visitas técnicas (duración y lugar), agrupadas en vencidas / hoy / 7 días / después. |
| Formulario público | `/f/<empresa>`, incrustable con `<iframe>` autoajustable; validación, campo trampa, tiempo mínimo firmado, límites por IP y por empresa, consentimiento RGPD con texto informativo configurable, fotos opcionales (tipo comprobado por contenido, 3 × 5 MB), confirmación con número de solicitud. |
| Automatizaciones | Aviso de nueva solicitud, recordatorio de presupuesto sin seguimiento, aviso de visita próxima, tarea para contactos sin atender. Activables por separado, plazos y destinatarios configurables, sin duplicados (clave única por caso), registro de ejecuciones y errores, bandeja de emails con reintentos (1, 5, 30, 120, 360 min). |
| Panel | Indicadores calculados en la base de datos (solicitudes, contactos sin atender, presupuestos pendientes, aceptados/rechazados, valor abierto, conversión), «Requiere atención», gráficos por mes, valor por fase, origen, agenda y actividad. |
| Administración | Datos de empresa y fiscales, logotipo, color de marca, horario, servicios, usuarios, plantillas de email con vista previa, formulario, campos personalizados, importación CSV con vista previa, exportación CSV y copia completa JSON, historial de auditoría. |
| Demo | Empresa ficticia restaurable con un clic (solo afecta a empresas marcadas como demo) y datos de ejemplo eliminables en empresas reales. |
| Manual | Manual de uso dentro de la aplicación (`/ayuda`) con guion de demostración de 5 minutos. |

### Requiere credenciales para funcionar en producción
| Función | Qué falta | Comportamiento sin ello |
|---|---|---|
| Envío de emails | `EMAIL_PROVIDER` + `EMAIL_FROM` + `RESEND_API_KEY` o datos SMTP | Las tareas automáticas se crean igualmente; los emails quedan como «No enviado: email sin configurar» y se pueden reintentar después. **Nunca se muestran como enviados.** El envío real no se ha podido probar en este entorno por falta de credenciales. |
| Recordatorios programados | `CRON_SECRET` y un cron (Vercel Cron o externo) | Solo se ejecutan con el botón «Ejecutar ahora». El aviso de nueva solicitud es inmediato y no depende del cron. |
| Base de datos | `DATABASE_URL` de un PostgreSQL gestionado | Todo se ha probado con PostgreSQL 16 local con un rol no superusuario, que reproduce un proveedor gestionado. |

### No implementado (decisión consciente o pendiente)
- **Envío del presupuesto al cliente desde la aplicación.** Hoy se descarga el PDF y se envía por el canal habitual; después se marca como enviado.
- **WhatsApp.** No integrado. Si se añade, debe ser con la API oficial de WhatsApp Business.
- **Recuperación de contraseña por email.** La restablece un propietario desde Usuarios (contraseña temporal).
- **Facturación, firma electrónica y calendario externo** (Google/Outlook).
- **Copias de seguridad propias.** Dependen del proveedor de PostgreSQL (ver abajo); la aplicación ofrece exportación manual.
- **Validación fiscal.** El sistema calcula, pero no decide qué tipo de IVA aplica ni valida precios técnicos.

---

## Consola de plataforma (`/admin`)

Panel exclusivo del equipo de Webera, separado de las cuentas de las empresas (otra tabla de usuarios, otra cookie limitada a `/admin`, sesiones de 12 horas y registro de todo lo que se hace).

- **Resumen:** empresas activas, usuarios, solicitudes y presupuestos de todas las empresas.
- **Alta de cliente:** crea la empresa con sus servicios, plantillas y automatizaciones por defecto, y el acceso de su propietario. Opcionalmente, con datos de ejemplo.
- **Contraseñas para clientes:** en cada usuario, «Cambiar contraseña…» permite generar una segura o escribirla a mano y elegir si debe cambiarla al entrar. Las credenciales se muestran **una sola vez** con un botón «Copiar acceso» (dirección, usuario y contraseña) para enviárselas al cliente. Cambiar una contraseña cierra sus sesiones abiertas.
- **Usuarios de todas las empresas:** búsqueda por email, nombre o empresa, con cambio de contraseña directo.
- **Empresas:** editar nombre, identificador y color, nota interna, **suspender** (nadie entra y el formulario deja de aceptar solicitudes; los datos se conservan), restaurar demos y eliminar (exige escribir el identificador).
- **Equipo Webera:** añadir o desactivar administradores y cambiar tu propia contraseña (mínimo 12 caracteres).
- **Registro:** cada acción de la consola queda anotada.

### Crear tu cuenta de administrador

Las credenciales nunca se guardan en el código. Se pasan por variables de entorno al ejecutar el script (también sirve para restablecer la contraseña si se olvida):

```bash
ADMIN_EMAIL='tu@email.com' ADMIN_PASSWORD='tu-contraseña-segura' ADMIN_NAME='Tu nombre' \
  DATABASE_URL='<url de producción>' npm run db:create-admin
```

Después entra en `https://<tu-app>/admin/login`.

## Tecnología

- **Next.js 15** (App Router, Server Actions) + **TypeScript** + **Tailwind CSS 4**.
- **PostgreSQL** estándar con `pg` (sin ORM), migraciones SQL en `db/migrations`.
- **Autenticación propia** en el servidor (no se usa Supabase por decisión del cliente).
- **@react-pdf/renderer** para los PDF, **nodemailer** para SMTP, API HTTP oficial de **Resend**.
- Despliegue previsto en **Vercel**.

## Instalación local

Requisitos: Node 20.9+ y PostgreSQL 14+.

```bash
npm install
cp .env.example .env.local        # rellena DATABASE_URL y SESSION_SECRET
npm run db:migrate                # crea tablas, rol webera_app y políticas RLS
DEMO_PASSWORD='elige-una-clave-2026' npm run db:seed-demo
npm run dev                       # http://localhost:3000
```

Accesos de la demo (contraseña la de `DEMO_PASSWORD`):
`propietario@demo.example` (propietario), `comercial@demo.example` y `tecnico@demo.example` (comerciales).

### Dar de alta un instalador real

```bash
npm run db:create-company -- --slug climatizacion-perez --name "Climatización Pérez" \
  --email propietario@climatizacionperez.es --owner "Ana Pérez" --color "#0f5f8c"
```

Imprime una contraseña temporal (se pide cambiarla al entrar) y la URL del formulario `/f/climatizacion-perez`. El resto se configura desde **Ajustes**.

## Variables de entorno

Documentadas una a una en [`.env.example`](.env.example).

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión PostgreSQL. El usuario debe poder `CREATE ROLE` (lo hace la migración). |
| `APP_DATABASE_URL` | No | Si existe, se usa en lugar de `DATABASE_URL` (útil cuando una integración ya fija `DATABASE_URL` a otra base de datos). |
| `SESSION_SECRET` | Sí en producción | 32+ caracteres aleatorios. Firma sesiones y tokens antispam. |
| `APP_URL` | Sí en producción | URL pública sin barra final. |
| `CRON_SECRET` | Recomendada | Protege `/api/cron/automations`. |
| `EMAIL_PROVIDER` | No | `resend` o `smtp`. |
| `EMAIL_FROM` | Con email | Remitente verificado. |
| `RESEND_API_KEY` | Con Resend | Clave de la API de Resend. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Con SMTP | Servidor SMTP. |
| `DATABASE_SSL`, `DATABASE_POOL_MAX` | No | Ajustes de conexión. |

## Despliegue en Vercel

1. Crea la base de datos (Neon, Vercel Postgres, Railway, servidor propio, etc.). En serverless usa la **URL con pooler** del proveedor.
2. Desde tu equipo: `DATABASE_URL=<url> npm run db:migrate` (y `db:seed-demo` si quieres la demo en ese entorno).
3. Importa el repositorio en Vercel y define las variables de entorno.
4. `vercel.json` programa `/api/cron/automations` una vez al día (`0 7 * * *` UTC), compatible con el plan gratuito. En un plan de pago, cambia a cada 15 minutos (`*/15 * * * *`) para que los recordatorios de visita sean puntuales. Alternativa: cualquier cron externo que llame a `GET https://<app>/api/cron/automations` con la cabecera `Authorization: Bearer <CRON_SECRET>`.
5. Comprueba **Ajustes › Resumen**: la lista de puesta en marcha indica qué falta.

Las funciones se ejecutan en Fráncfort (`"regions": ["fra1"]` en `vercel.json`); crea la base de datos en la misma región (Neon `aws-eu-central-1`) para que cada consulta no cruce el Atlántico. Si el servidor no tiene `DATABASE_URL` o faltan las tablas, las pantallas de acceso (`/login` y `/admin/login`) lo dicen con un mensaje claro en lugar de fallar en silencio.

### Copias de seguridad
La aplicación no hace copias de la base de datos por sí misma. Activa las del proveedor (Neon: historial de restauración por punto en el tiempo según plan; Railway/Vercel Postgres: copias según plan; servidor propio: `pg_dump` programado). Como respaldo funcional, el propietario puede descargar la copia completa en JSON desde **Ajustes › Importar, exportar y demo**.

## Seguridad: cómo se separan los datos

1. Cada tabla de negocio lleva `company_id` y tiene **Row Level Security** con política `company_id = app_company_id()`.
2. Las pantallas y acciones ejecutan sus consultas dentro de `withTenant()`: transacción con `SET LOCAL ROLE webera_app` (rol sin propiedad de las tablas, por lo que RLS siempre se aplica) y `app.company_id` fijado desde la sesión validada en el servidor.
3. El rol `webera_app` no puede leer `password_hash`, ni la tabla de sesiones, ni la de límites.
4. El contexto sin RLS (`withSystem`) se limita a: inicio de sesión, resolución del formulario público por su identificador, logotipo público, límites de peticiones, cron y scripts de administración.
5. Cada acción comprueba además el permiso del rol (`requireCapability`).
6. Fotos y PDF solo se sirven con sesión y desde la propia empresa; cabeceras `nosniff` y CSP restrictiva. La aplicación no se puede incrustar en otras webs (`frame-ancestors 'none'`), salvo el formulario público.
7. Las exportaciones CSV neutralizan fórmulas de Excel.

## Pruebas

```bash
npm run typecheck && npm run lint
npm test                                              # unitarias (cálculo, importes, fechas, CSV)
TEST_DATABASE_URL=<bd vacía migrada> npm run test:db  # RLS y automatizaciones contra PostgreSQL real
E2E_DATABASE_URL=<bd con demo> npm run test:e2e       # navegador contra la app en marcha
```

Resultado en la última ejecución: 25 unitarias, 11 de base de datos y 8 de extremo a extremo superadas (flujo completo contacto → presupuesto revisado → PDF, formulario público, permisos por rol, aislamiento entre empresas y consola: alta de cliente, contraseñas, primer acceso, suspensión y baja).

## Estructura

```
db/migrations/        SQL: tablas, rol webera_app, RLS, consola de plataforma
scripts/              migrar, demo, alta de empresa
src/app/(app)/        pantallas autenticadas
src/app/f/[slug]/     formulario público
src/app/admin/        consola de plataforma de Webera
src/app/api/          PDF, exportación, fotos, logotipo, cron
src/server/           consultas y lógica de servidor
src/lib/              dominio (cálculo, fechas, validación, CSV), auth, email
tests/, e2e/          pruebas
PRODUCT.md, DESIGN.md contexto de producto y sistema visual
```

## Avisos

- El texto de protección de datos del formulario es una base informativa: cada empresa debe revisarlo con su asesoría y enlazar su política de privacidad.
- Los datos de demostración son ficticios (teléfonos 600 000 xxx, emails `.example`) y así se indica en pantalla. Sus precios no son tarifas reales.
- Dependencia de desarrollo con aviso de seguridad sin parche (`braces`, vía ESLint): solo afecta a las herramientas de desarrollo, no a la aplicación desplegada.
