import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-4 py-5">
      <div className="min-w-0 max-w-3xl">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
