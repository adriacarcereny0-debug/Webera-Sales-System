-- Correo de envío propio de cada empresa (su Gmail, su cuenta de Resend o el SMTP de su hosting).
-- La contraseña o clave se guarda cifrada (AES-256-GCM) y nunca se devuelve a la pantalla.
-- Solo se accede desde el servidor en modo sistema y tras comprobar permisos: el rol de la app no la ve.
create table company_email_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  provider text not null check (provider in ('gmail','smtp','resend')),
  from_email text not null,
  smtp_host text,
  smtp_port int check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_secure boolean not null default true,
  smtp_user text,
  secret_enc text not null,
  secret_hint text,
  tested_at timestamptz,
  test_ok boolean,
  test_error text,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger company_email_settings_updated before update on company_email_settings for each row execute function set_updated_at();
alter table company_email_settings enable row level security;
revoke all on company_email_settings from webera_app;
