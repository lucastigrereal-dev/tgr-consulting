import type { FinancialCalculation } from "@shared/financial/types";
import React from "react";

export function ChapterFormulaTrace({
  memory,
  source,
}: {
  memory: FinancialCalculation["memory"];
  source: "snapshot" | "ficha_mae";
}) {
  if (source === "ficha_mae") {
    return <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-amber-200/80">Origem: ficha-mãe e premissas autoritativas</p>;
  }
  if (!memory.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="chapter-formula-trace">
      {memory.map(item => (
        <span className="rounded border border-amber-200/20 bg-amber-100/[0.035] px-2 py-1 text-[10px] text-amber-100/90" key={item.formulaId}>
          {item.formulaId} · v{item.formulaVersion}
        </span>
      ))}
    </div>
  );
}
