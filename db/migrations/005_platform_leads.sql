-- Solicitudes de instaladores interesados (formulario público de Webera) y ajustes de la plataforma.
create table platform_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  company text not null check (length(company) between 2 and 160),
  email text not null,
  phone text,
  city text,
  team_size text,
  message text,
  status text not null default 'nueva' check (status in ('nueva','contactada','alta','descartada')),
  notes text,
  company_id uuid references companies(id) on delete set null,
  source text,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_leads_status_idx on platform_leads(status, created_at desc);
create trigger platform_leads_updated before update on platform_leads for each row execute function set_updated_at();
alter table platform_leads enable row level security;
revoke all on platform_leads from webera_app;

-- Una sola fila: correo de Webera (avisos de solicitudes, respuesta a interesados y respaldo para empresas sin correo propio).
create table platform_settings (
  id boolean primary key default true check (id),
  provider text check (provider in ('gmail','smtp','resend')),
  from_email text,
  smtp_host text,
  smtp_port int check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  smtp_user text,
  secret_enc text,
  secret_hint text,
  tested_at timestamptz,
  test_ok boolean,
  test_error text,
  notify_emails text[] not null default '{}',
  lead_auto_reply boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger platform_settings_updated before update on platform_settings for each row execute function set_updated_at();
insert into platform_settings(id) values (true);
alter table platform_settings enable row level security;
revoke all on platform_settings from webera_app;
