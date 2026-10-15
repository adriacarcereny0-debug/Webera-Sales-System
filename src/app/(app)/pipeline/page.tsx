import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireSession, tenant } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { OPEN_STAGES, type Stage } from "@/lib/stages";
import { formatCents } from "@/lib/money";
import { fmtShortDay } from "@/lib/dates";
import { PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { AutoSubmitForm } from "@/components/ui/auto-submit";
import { listUsers } from "@/server/contacts";
import { PipelineBoard, type BoardCard } from "./board";

export const metadata: Metadata = { title: "Pipeline" };
const CLOSED_DAYS = 90;

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ responsable?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const owner = sp.responsable && /^[0-9a-f-]{36}$/.test(sp.responsable) ? sp.responsable : null;
  const { rows, users } = await tenant(s, async (tx) => ({
    rows: await tx.query<{
      id: string; folio: string; name: string; city: string | null; service: string | null; amount: string | null;
      owner: string | null; next_action: string | null; next_action_at: string | null; stage: Stage;
    }>(
      `select c.id, c.folio, c.name, c.city, s.name as service, c.estimated_amount_cents as amount, u.name as owner,
              c.next_action, c.next_action_at, c.stage
         from contacts c left join services s on s.id = c.service_id left join users u on u.id = c.owner_id
        where (c.stage not in ('ganado','perdido') or c.stage_changed_at > now() - make_interval(days => $1))
          and ($2::uuid is null or c.owner_id = $2::uuid)
        order by c.next_action_at asc nulls last, c.created_at desc
        limit 600`,
      [CLOSED_DAYS, owner],
    ),
    users: await listUsers(tx),
  }));
  const now = new Date();
  const cards: BoardCard[] = rows.map((r) => ({
    id: r.id, folio: r.folio, name: r.name, city: r.city, service: r.service, amount: r.amount ? Number(r.amount) : null,
    owner: r.owner, nextAction: r.next_action, nextAt: r.next_action_at, stage: r.stage,
    overdue: !!r.next_action_at && new Date(r.next_action_at) < now && OPEN_STAGES.includes(r.stage),
    nextLabel: r.next_action || r.next_action_at ? `${r.next_action ?? "Acción"}${r.next_action_at ? ` · ${fmtShortDay(r.next_action_at)}` : ""}` : null,
  }));
  const openValue = cards.filter((c) => OPEN_STAGES.includes(c.stage)).reduce((a, c) => a + (c.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={<>Oportunidades en curso por fase. Valor abierto: <strong className="num font-semibold text-ink">{formatCents(openValue, { compact: true })}</strong> sin IVA.</>}
        actions={
          <>
            <AutoSubmitForm className="flex items-center gap-2">
              <label htmlFor="responsable" className="sr-only">Responsable</label>
              <Select id="responsable" name="responsable" defaultValue={owner ?? ""} className="w-56">
                <option value="">Todos los responsables</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
              <noscript><button type="submit">Filtrar</button></noscript>
            </AutoSubmitForm>
            {can(s.user.role, "crm.write") && <ButtonLink href="/contactos/nuevo" variant="primary"><Plus className="size-4" strokeWidth={2} aria-hidden />Nuevo contacto</ButtonLink>}
          </>
        }
      />
      <PipelineBoard cards={cards} canWrite={can(s.user.role, "crm.write")}
        closedLimitNote={`Las columnas Ganado y Perdido muestran los cambios de los últimos ${CLOSED_DAYS} días. El historial completo está en Contactos.`} />
    </>
  );
}
