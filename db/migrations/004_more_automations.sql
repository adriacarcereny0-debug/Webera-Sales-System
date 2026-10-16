-- Más automatizaciones y presupuesto online.
alter table automations drop constraint if exists automations_key_check;
alter table automations add constraint automations_key_check check (key in (
  'respuesta_cliente','aviso_nueva_solicitud','asignacion_automatica','unificar_duplicados','tarea_contacto_nuevo',
  'fase_automatica','tarea_tras_visita','recordatorio_visita','recordatorio_visita_cliente',
  'seguimiento_presupuesto','seguimiento_cliente','caducar_presupuestos','resumen_diario'));

-- Enlace público del presupuesto (lo abre el cliente para verlo y aceptarlo). El token es aleatorio y largo.
alter table quotes add column public_token text unique;
alter table quotes add column client_viewed_at timestamptz;
alter table quotes add column client_note text;
alter table quotes add column emailed_at timestamptz;
alter table quotes add column emailed_to text;
