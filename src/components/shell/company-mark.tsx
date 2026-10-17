/* eslint-disable @next/next/no-img-element */
export function CompanyMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-1">
          <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
        </span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/12 text-sm font-semibold text-white">{initials}</span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[0.92rem] font-semibold leading-tight text-white">{name}</span>
        <span className="block text-[0.72rem] leading-tight text-white/55">Webora Studio</span>
      </span>
    </div>
  );
}
