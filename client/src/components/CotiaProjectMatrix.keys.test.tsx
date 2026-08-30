import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CotiaProjectMatrix } from "./CotiaProjectMatrix";

describe("CotiaProjectMatrix · estabilidade de listas", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza a folha real sem warning de key em tabelas", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const html = renderToStaticMarkup(
      <CotiaProjectMatrix
        values={{}}
        sourceRef=""
        status="pending"
        onChange={() => undefined}
        onSourceChange={() => undefined}
        onStatusChange={() => undefined}
        onSave={() => undefined}
      />
    );

    expect(html).toContain("Matriz de Montagem da Operação");
    expect(html).toContain("Máquina de captação / OPC por canal");
    expect(html).toContain(
      "Pré-investimento / operação recorrente / entrada líquida"
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /unique [\"']key[\"'] prop|Each child in a list/i
    );
  });
});
