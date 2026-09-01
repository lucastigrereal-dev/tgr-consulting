import React, { useId } from "react";

export function ResponsiveTableFrame({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = useId();

  return (
    <div className="min-w-0">
      <p id={hintId} className="mb-2 text-[11px] text-muted-foreground sm:hidden">
        Deslize horizontalmente para consultar todas as colunas. A primeira coluna permanece visível.
      </p>
      <div
        role="region"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        className={`overflow-x-auto overscroll-x-contain outline-none focus-visible:ring-2 focus-visible:ring-amber-200 [&_td:first-child]:sticky [&_td:first-child]:left-0 [&_td:first-child]:z-10 [&_td:first-child]:bg-slate-950 [&_th:first-child]:sticky [&_th:first-child]:left-0 [&_th:first-child]:z-20 [&_th:first-child]:bg-slate-950 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
