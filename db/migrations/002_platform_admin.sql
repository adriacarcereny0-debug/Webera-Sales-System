-- Panel de plataforma (/admin) para el equipo de Webera.
-- Los administradores de plataforma son cuentas separadas de los usuarios de las
-- empresas: otra tabla, otra cookie de sesión y ningún permiso para el rol webera_app.

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger platform_admins_updated before update on platform_admins for each row execute function set_updated_at();

create table platform_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references platform_admins(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index platform_sessions_admin_idx on platform_sessions(admin_id);

create table platform_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references platform_admins(id) on delete set null,
  action text not null,
  company_id uuid references companies(id) on delete set null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_created_idx on platform_audit(created_at desc);

-- Suspender una empresa impide el acceso de todos sus usuarios y su formulario web.
alter table companies add column active boolean not null default true;
alter table companies add column plan_note text;

-- Sin permisos para el rol de aplicación; RLS activa y sin políticas como defensa adicional.
alter table platform_admins enable row level security;
alter table platform_sessions enable row level security;
alter table platform_audit enable row level security;
revoke all on platform_admins, platform_sessions, platform_audit from webera_app;
