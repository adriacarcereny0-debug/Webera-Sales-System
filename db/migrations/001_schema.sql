-- Webera Sales System · esquema inicial
-- Multiempresa: cada tabla de negocio lleva company_id y está protegida con RLS.
-- La aplicación ejecuta las consultas de negocio con `SET LOCAL ROLE webera_app`
-- y `app.company_id` fijado en la transacción; ese rol no es propietario de las
-- tablas, por lo que las políticas RLS se aplican siempre. El propietario de las
-- tablas solo se usa en el módulo de sistema (login, formulario público, cron).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Rol de aplicación sin login
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'webera_app') then
    create role webera_app nologin;
  end if;
end $$;

-- El rol que ejecuta migraciones (y la app) debe poder hacer SET ROLE webera_app.
do $$
begin
  begin
    execute format('grant webera_app to %I with set true', current_user);
  exception when syntax_error or feature_not_supported then
    execute format('grant webera_app to %I', current_user);
  end;
exception when others then
  -- superusuario o ya concedido
  null;
end $$;

create or replace function app_company_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.company_id', true), '')::uuid
$$;

create or replace function app_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name text not null check (length(name) between 2 and 120),
  legal_name text,
  tax_id text,
  email text,
  phone text,
  website text,
  address text,
  city text,
  postal_code text,
  province text,
  schedule text,
  brand_color text not null default '#23408e' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_data bytea,
  logo_mime text check (logo_mime is null or logo_mime in ('image/png','image/jpeg','image/webp')),
  quote_prefix text not null default 'P',
  quote_validity_days int not null default 30 check (quote_validity_days between 1 and 365),
  quote_terms text,
  quote_footer text,
  default_tax_rate numeric(5,2) not null default 21,
  tax_rates jsonb not null default '[21,10,4,0]'::jsonb,
  privacy_url text,
  privacy_controller text,
  form_enabled boolean not null default true,
  form_photos_enabled boolean not null default false,
  form_intro text,
  form_thanks text,
  notification_emails text[] not null default '{}',
  custom_fields jsonb not null default '[]'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_updated before update on companies for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Usuarios y sesiones
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  role text not null check (role in ('propietario','administrador','comercial','lectura')),
  active boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_company_idx on users(company_id);
create trigger users_updated before update on users for each row execute function set_updated_at();

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on sessions(user_id);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- ---------------------------------------------------------------------------
-- Contadores por empresa (folios de contacto, numeración de presupuestos)
-- ---------------------------------------------------------------------------
create table counters (
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  value bigint not null default 0,
  primary key (company_id, key)
);

create or replace function next_counter(p_company uuid, p_key text) returns bigint
language plpgsql as $$
declare v bigint;
begin
  insert into counters(company_id, key, value) values (p_company, p_key, 1)
  on conflict (company_id, key) do update set value = counters.value + 1
  returning value into v;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Servicios / tipos de instalación
-- ---------------------------------------------------------------------------
create table services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null check (length(name) between 2 and 80),
  description text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

-- ---------------------------------------------------------------------------
-- Contactos / oportunidades
-- ---------------------------------------------------------------------------
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  folio bigint not null,
  name text not null check (length(name) between 1 and 160),
  company_name text,
  phone text,
  email text,
  address text,
  city text,
  postal_code text,
  service_id uuid references services(id) on delete set null,
  source text not null default 'otro' check (source in ('formulario_web','telefono','whatsapp','email','recomendacion','feria','portal','visita_tienda','importacion','otro')),
  owner_id uuid references users(id) on delete set null,
  estimated_amount_cents bigint check (estimated_amount_cents is null or estimated_amount_cents >= 0),
  stage text not null default 'nuevo' check (stage in ('nuevo','pendiente_contactar','visita_programada','presupuesto_enviado','seguimiento','ganado','perdido')),
  stage_changed_at timestamptz not null default now(),
  lost_reason text,
  next_action text,
  next_action_at timestamptz,
  timeframe text,
  description text,
  consent_at timestamptz,
  custom_values jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, folio)
);
create index contacts_company_stage_idx on contacts(company_id, stage);
create index contacts_company_created_idx on contacts(company_id, created_at desc);
create index contacts_company_email_idx on contacts(company_id, lower(email));
create index contacts_company_phone_idx on contacts(company_id, phone);
create trigger contacts_updated before update on contacts for each row execute function set_updated_at();

create or replace function contacts_assign_folio() returns trigger
language plpgsql as $$
begin
  if new.folio is null then
    new.folio := next_counter(new.company_id, 'contact');
  end if;
  return new;
end $$;
create trigger contacts_folio before insert on contacts for each row execute function contacts_assign_folio();

create table stage_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  user_id uuid references users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index stage_history_contact_idx on stage_history(contact_id, created_at desc);
create index stage_history_company_idx on stage_history(company_id, created_at desc);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  filename text not null,
  mime text not null check (mime in ('image/png','image/jpeg','image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  data bytea not null,
  created_at timestamptz not null default now()
);
create index attachments_contact_idx on attachments(contact_id);

-- ---------------------------------------------------------------------------
-- Presupuestos
-- ---------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete restrict,
  number bigint not null,
  code text not null,
  title text not null default 'Presupuesto',
  status text not null default 'borrador' check (status in ('borrador','revisado','enviado','aceptado','rechazado','caducado')),
  issue_date date not null default current_date,
  valid_until date not null,
  notes text,
  next_step text,
  terms text,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  check (valid_until >= issue_date)
);
create index quotes_company_status_idx on quotes(company_id, status);
create index quotes_contact_idx on quotes(contact_id);
create trigger quotes_updated before update on quotes for each row execute function set_updated_at();

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  position int not null,
  description text not null check (length(description) between 1 and 500),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null default 'ud',
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  tax_rate numeric(5,2) not null check (tax_rate between 0 and 100),
  line_net_cents bigint not null
);
create index quote_items_quote_idx on quote_items(quote_id, position);

-- ---------------------------------------------------------------------------
-- Tareas y visitas
-- ---------------------------------------------------------------------------
create table tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null default 'tarea' check (kind in ('tarea','visita')),
  title text not null check (length(title) between 1 and 200),
  notes text,
  due_at timestamptz not null,
  ends_at timestamptz,
  location text,
  contact_id uuid references contacts(id) on delete cascade,
  quote_id uuid references quotes(id) on delete set null,
  assigned_to uuid references users(id) on delete set null,
  done_at timestamptz,
  source text not null default 'manual' check (source in ('manual','automatizacion','formulario')),
  is_demo boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= due_at)
);
create index tasks_company_due_idx on tasks(company_id, due_at) where done_at is null;
create index tasks_contact_idx on tasks(contact_id);
create trigger tasks_updated before update on tasks for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Actividad comercial (notas, llamadas, eventos)
-- ---------------------------------------------------------------------------
create table activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  quote_id uuid references quotes(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  type text not null check (type in ('nota','llamada','email','whatsapp','visita','cambio_fase','presupuesto','tarea','formulario','automatizacion','sistema')),
  body text,
  meta jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index activities_contact_idx on activities(contact_id, created_at desc);
create index activities_company_idx on activities(company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Plantillas, automatizaciones y bandeja de salida de emails
-- ---------------------------------------------------------------------------
create table email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  name text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);
create trigger email_templates_updated before update on email_templates for each row execute function set_updated_at();

create table automations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  key text not null check (key in ('aviso_nueva_solicitud','seguimiento_presupuesto','recordatorio_visita','tarea_contacto_nuevo')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);
create trigger automations_updated before update on automations for each row execute function set_updated_at();

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  automation_key text not null,
  dedupe_key text not null,
  status text not null check (status in ('ok','omitido','error')),
  detail text,
  created_at timestamptz not null default now(),
  unique (company_id, automation_key, dedupe_key)
);
create index automation_runs_company_idx on automation_runs(company_id, created_at desc);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'pendiente' check (status in ('pendiente','aceptado','error','no_configurado','descartado')),
  provider text,
  provider_message_id text,
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  related_type text,
  related_id uuid,
  automation_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on email_outbox(next_attempt_at) where status = 'pendiente';
create index email_outbox_company_idx on email_outbox(company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Registro de auditoría de administración
-- ---------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_company_idx on audit_log(company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Permisos del rol de aplicación
-- ---------------------------------------------------------------------------
grant usage on schema public to webera_app;
grant select, update on companies to webera_app;
grant select, insert, update on users to webera_app;
grant select, insert, update, delete on
  counters, services, contacts, stage_history, attachments, quotes, quote_items,
  tasks, activities, email_templates, automations, automation_runs, email_outbox, audit_log
  to webera_app;
-- sessions y rate_limits: solo contexto de sistema (sin permisos para webera_app).
grant execute on function app_company_id(), app_user_id(), next_counter(uuid, text) to webera_app;

-- La columna password_hash no se expone al rol de aplicación.
revoke select on users from webera_app;
grant select (id, company_id, email, name, role, active, must_change_password, last_login_at, created_at, updated_at) on users to webera_app;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
create policy companies_tenant on companies
  using (id = app_company_id())
  with check (id = app_company_id());

do $$
declare t text;
begin
  foreach t in array array[
    'users','counters','services','contacts','stage_history','attachments','quotes','quote_items',
    'tasks','activities','email_templates','automations','automation_runs','email_outbox','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I using (company_id = app_company_id()) with check (company_id = app_company_id())',
      t || '_tenant', t);
  end loop;
end $$;

-- sessions y rate_limits también con RLS activa y sin políticas para webera_app:
alter table sessions enable row level security;
alter table rate_limits enable row level security;
