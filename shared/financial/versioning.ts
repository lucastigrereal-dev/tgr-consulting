import type { ProjectVersionGuard } from "./types";

export function assertVersionCanBeMutated(version: ProjectVersionGuard): void {
  if (version.isImmutable || version.state === "baseline") {
    throw new Error(
      "Baseline congelado: crie um branch para alterar premissas ou fórmulas."
    );
  }
  if (version.state === "approved") {
    throw new Error(
      "Versão aprovada: altere por meio de um novo branch auditável."
    );
  }
}

export function createScenarioBranch(params: {
  branchId: string;
  parent: ProjectVersionGuard;
}): ProjectVersionGuard {
  return {
    id: params.branchId,
    projectId: params.parent.projectId,
    state: "draft",
    isImmutable: false,
    parentVersionId: params.parent.id,
  };
}

export function freezeBaseline(
  version: ProjectVersionGuard
): ProjectVersionGuard {
  if (version.state !== "approved") {
    throw new Error(
      "Somente uma versão aprovada pode ser congelada como baseline."
    );
  }
  return { ...version, state: "baseline", isImmutable: true };
}
