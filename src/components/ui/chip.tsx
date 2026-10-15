import { cn } from "@/lib/cn";
import { QUOTE_STATUS, STAGE_META, type QuoteStatus, type Stage } from "@/lib/stages";

export function Chip({ tint, children, className }: { tint: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(tint, "tint-chip inline-flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-[0.78rem] font-medium whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function StageChip({ stage, short }: { stage: Stage; short?: boolean }) {
  const m = STAGE_META[stage];
  return <Chip tint={m.tint}>{short ? m.short : m.label}</Chip>;
}

export function QuoteStatusChip({ status }: { status: QuoteStatus }) {
  const m = QUOTE_STATUS[status];
  return <Chip tint={m.tint}>{m.label}</Chip>;
}

export function DemoChip() {
  return <Chip tint="tint-amarilla" className="uppercase tracking-wide text-[0.68rem]">Demo</Chip>;
}
