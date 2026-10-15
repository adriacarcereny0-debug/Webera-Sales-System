import "server-only";
import type { Tx } from "@/lib/db";
import { parseCustomFields, type CustomField } from "@/lib/custom-fields";

export interface CompanySettings {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  schedule: string | null;
  brand_color: string;
  has_logo: boolean;
  quote_prefix: string;
  quote_validity_days: number;
  quote_terms: string | null;
  quote_footer: string | null;
  default_tax_rate: string;
  tax_rates: number[];
  privacy_url: string | null;
  privacy_controller: string | null;
  form_enabled: boolean;
  form_photos_enabled: boolean;
  form_intro: string | null;
  form_thanks: string | null;
  notification_emails: string[];
  custom_fields: CustomField[];
  is_demo: boolean;
}

export async function getCompany(tx: Tx): Promise<CompanySettings> {
  const row = await tx.one<CompanySettings & { custom_fields: unknown }>(
    `select id, slug, name, legal_name, tax_id, email, phone, website, address, city, postal_code, province, schedule,
            brand_color, (logo_data is not null) as has_logo, quote_prefix, quote_validity_days, quote_terms, quote_footer,
            default_tax_rate, tax_rates, privacy_url, privacy_controller, form_enabled, form_photos_enabled, form_intro,
            form_thanks, notification_emails, custom_fields, is_demo
       from companies where id = app_company_id()`,
  );
  if (!row) throw new Error("Empresa no encontrada");
  return { ...row, custom_fields: parseCustomFields(row.custom_fields), tax_rates: (row.tax_rates as number[]).map(Number) };
}
