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

  it("distingue zero real de ausencia e expõe labels acessiveis nas premissas", () => {
    const html = renderToStaticMarkup(
      <CotiaProjectMatrix
        values={{
          valorCota: "0",
          valorEntrada: "0",
          parcelasEntrada: "1",
          cotasPorApartamento: "52",
          totalApartamentos: "1",
          cotasBloqueadas: "0",
        }}
        sourceRef="Ata 42"
        status="pending"
        onChange={() => undefined}
        onSourceChange={() => undefined}
        onStatusChange={() => undefined}
        onSave={() => undefined}
      />
    );

    expect(html).toContain("R$");
    expect(html).toContain("0,00");
    expect(html).toMatch(/Estoque f(?:i|í)sico/);
    expect(html).toMatch(/Estoque vend(?:a|á)vel/);
    expect(html).toContain('id="cotia-valorCota"');
    expect(html).toContain('name="valorCota"');
    expect(html).toContain('aria-label="Valor da cota"');
    expect(html).toContain('id="cotia-cotasBloqueadas"');
    expect(html).toContain('aria-label="Cotas bloqueadas"');
    expect(html).toContain('for="cotia-comissaoCorretorValor"');
    expect(html).toContain('for="cotia-cartaoVistaPercentual"');
    expect(html).toMatch(/Premissa edit(?:a|á)vel/);
    expect(html).toContain("nenhuma regra é inventada");
    expect(html).toContain("Digite 1 para 1% e 0,5 para 0,5%");
  });
});
