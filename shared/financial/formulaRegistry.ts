import type { FormulaDefinition, FormulaSetVersion } from "./types";

export type FormulaLineageNode = {
  id: string;
  kind: "formula" | "input";
  label: string;
  depth: number;
  parentFormulaId?: string;
};

export class FormulaRegistry {
  private readonly formulaSets = new Map<string, FormulaSetVersion>();
  private activeFormulaSetId!: string;

  constructor(formulaSets: FormulaSetVersion[], activeFormulaSetId: string) {
    if (formulaSets.length === 0) throw new Error("O registry precisa de pelo menos um formula set.");
    for (const formulaSet of formulaSets) this.register(formulaSet);
    this.selectActiveFormulaSet(activeFormulaSetId);
  }

  register(formulaSet: FormulaSetVersion): void {
    if (this.formulaSets.has(formulaSet.id)) throw new Error(`Formula set duplicado: ${formulaSet.id}`);
    if (formulaSet.definitions.length === 0) throw new Error("Formula set sem fórmulas não pode ser registrado.");
    const formulaIds = new Set<string>();
    for (const definition of formulaSet.definitions) {
      if (formulaIds.has(definition.id)) throw new Error(`Fórmula duplicada: ${definition.id}`);
      formulaIds.add(definition.id);
    }
    this.formulaSets.set(formulaSet.id, formulaSet);
  }

  list(): FormulaSetVersion[] {
    return Array.from(this.formulaSets.values());
  }

  getFormulaSet(id: string): FormulaSetVersion {
    const formulaSet = this.formulaSets.get(id);
    if (!formulaSet) throw new Error(`Formula set não encontrado: ${id}`);
    return formulaSet;
  }

  getActiveFormulaSet(): FormulaSetVersion {
    return this.getFormulaSet(this.activeFormulaSetId);
  }

  selectActiveFormulaSet(id: string): void {
    const formulaSet = this.getFormulaSet(id);
    if (formulaSet.status !== "published") throw new Error("Somente formula set publicado pode ficar ativo.");
    this.activeFormulaSetId = id;
  }

  getFormula(formulaId: string, formulaSetId = this.activeFormulaSetId): FormulaDefinition {
    const formula = this.getFormulaSet(formulaSetId).definitions.find((candidate) => candidate.id === formulaId);
    if (!formula) throw new Error(`Fórmula não encontrada: ${formulaId}`);
    return formula;
  }

  getLineage(formulaId: string, formulaSetId = this.activeFormulaSetId): FormulaLineageNode[] {
    const formulaSet = this.getFormulaSet(formulaSetId);
    const formulaIds = new Set(formulaSet.definitions.map((definition) => definition.id));
    const nodes: FormulaLineageNode[] = [];
    const visited = new Set<string>();

    const visit = (currentFormulaId: string, depth: number, parentFormulaId?: string) => {
      const visitKey = `${parentFormulaId ?? "root"}:${currentFormulaId}`;
      if (visited.has(visitKey)) return;
      visited.add(visitKey);
      const formula = this.getFormula(currentFormulaId, formulaSetId);
      nodes.push({ id: formula.id, kind: "formula", label: formula.name, depth, parentFormulaId });
      for (const dependency of formula.dependencies) {
        if (formulaIds.has(dependency)) {
          visit(dependency, depth + 1, formula.id);
        } else {
          nodes.push({ id: dependency, kind: "input", label: dependency, depth: depth + 1, parentFormulaId: formula.id });
        }
      }
    };

    visit(formulaId, 0);
    return nodes;
  }
}
