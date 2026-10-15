import "server-only";
import type { Tx } from "@/lib/db";
import type { Source, Stage } from "@/lib/stages";

/**
 * Todas las cifras del panel se calculan aquí, directamente sobre la base de datos
 * de la empresa (RLS). Nada es estimado ni inventado: si no hay datos, se devuelve 0.
 */
export async function dashboardData(tx: Tx, userId: string) {
  const k = await tx.one<{
    leads_30: number; leads_prev_30: number; leads_web_30: number; new_now: number; unassigned: number;
    q_draft: number; q_reviewed: number; q_sent: number; q_sent_value: string; q_sent_overdue: number;
    q_acc_90: number; q_rej_90: number; q_acc_value_90: string;
    open_value: string; open_count: number; won_180: number; lost_180: number; overdue_tasks: number;
  }>(`
    select
      (select count(*)::int from contacts where created_at >= now() - interval '30 days') as leads_30,
      (select count(*)::int from contacts where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days') as leads_prev_30,
      (select count(*)::int from contacts where created_at >= now() - interval '30 days' and source = 'formulario_web') as leads_web_30,
      (select count(*)::int from contacts where stage = 'nuevo') as new_now,
      (select count(*)::int from contacts where owner_id is null and stage not in ('ganado','perdido')) as unassigned,
      (select count(*)::int from quotes where status = 'borrador') as q_draft,
      (select count(*)::int from quotes where status = 'revisado') as q_reviewed,
      (select count(*)::int from quotes where status = 'enviado') as q_sent,
      (select coalesce(sum(subtotal_cents),0) from quotes where status = 'enviado') as q_sent_value,
      (select count(*)::int from quotes where status = 'enviado' and valid_until < (now() at time zone 'Europe/Madrid')::date) as q_sent_overdue,
      (select count(*)::int from quotes where status = 'aceptado' and decided_at >= now() - interval '90 days') as q_acc_90,
      (select count(*)::int from quotes where status = 'rechazado' and decided_at >= now() - interval '90 days') as q_rej_90,
      (select coalesce(sum(subtotal_cents),0) from quotes where status = 'aceptado' and decided_at >= now() - interval '90 days') as q_acc_value_90,
      (select coalesce(sum(estimated_amount_cents),0) from contacts where stage not in ('ganado','perdido')) as open_value,
      (select count(*)::int from contacts where stage not in ('ganado','perdido')) as open_count,
      (select count(*)::int from contacts where stage = 'ganado' and stage_changed_at >= now() - interval '180 days') as won_180,
      (select count(*)::int from contacts where stage = 'perdido' and stage_changed_at >= now() - interval '180 days') as lost_180,
      (select count(*)::int from tasks where done_at is null and due_at < now()) as overdue_tasks`);

  const leadsByMonth = await tx.query<{ month: string; n: number }>(`
    with months as (
      select generate_series(date_trunc('month', (now() at time zone 'Europe/Madrid')) - interval '5 months',
                             date_trunc('month', (now() at time zone 'Europe/Madrid')), interval '1 month') as m)
    select to_char(m, 'YYYY-MM-01') as month,
           (select count(*)::int from contacts c where date_trunc('month', c.created_at at time zone 'Europe/Madrid') = m) as n
      from months order by m`);

  const wonByMonth = await tx.query<{ month: string; cents: string; n: number }>(`
    with months as (
      select generate_series(date_trunc('month', (now() at time zone 'Europe/Madrid')) - interval '5 months',
                             date_trunc('month', (now() at time zone 'Europe/Madrid')), interval '1 month') as m)
    select to_char(m, 'YYYY-MM-01') as month,
           coalesce((select sum(q.subtotal_cents) from quotes q where q.status = 'aceptado' and date_trunc('month', q.decided_at at time zone 'Europe/Madrid') = m), 0) as cents,
           (select count(*)::int from quotes q where q.status = 'aceptado' and date_trunc('month', q.decided_at at time zone 'Europe/Madrid') = m) as n
      from months order by m`);

  const byStage = await tx.query<{ stage: Stage; n: number; cents: string }>(
    `select stage, count(*)::int as n, coalesce(sum(estimated_amount_cents),0) as cents from contacts where stage not in ('ganado','perdido') group by stage`);

  const bySource = await tx.query<{ source: Source; n: number }>(
    `select source, count(*)::int as n from contacts where created_at >= now() - interval '90 days' group by source order by n desc limit 6`);

  const agenda = await tx.query<{ id: string; kind: "tarea" | "visita"; title: string; due_at: string; location: string | null; contact_id: string | null; contact_name: string | null; assignee: string | null; mine: boolean }>(`
    select t.id, t.kind, t.title, t.due_at, t.location, t.contact_id, c.name as contact_name, u.name as assignee, (t.assigned_to = $1) as mine
      from tasks t left join contacts c on c.id = t.contact_id left join users u on u.id = t.assigned_to
     where t.done_at is null and t.due_at < now() + interval '7 days'
     order by t.due_at limit 8`, [userId]);

  const activity = await tx.query<{ id: string; type: string; body: string | null; created_at: string; contact_id: string | null; contact_name: string | null; user_name: string | null }>(`
    select a.id, a.type, a.body, a.created_at, a.contact_id, c.name as contact_name, u.name as user_name
      from activities a left join contacts c on c.id = a.contact_id left join users u on u.id = a.user_id
     order by a.created_at desc limit 8`);

  return { k: k!, leadsByMonth, wonByMonth, byStage, bySource, agenda, activity };
}
