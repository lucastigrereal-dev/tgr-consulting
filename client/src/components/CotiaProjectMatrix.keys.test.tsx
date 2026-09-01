import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as cotiaMatrixModule from "./CotiaProjectMatrix";

const { CotiaProjectMatrix } = cotiaMatrixModule;

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
    expect(html).toContain("TGR Consulting · Dados do projeto");
    expect(html).not.toMatch(/Hospedar|Da Mata/);
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
          encargosExplicitos: "125",
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
    expect(html).toContain('name="encargosExplicitos" value="125"');
    expect(html).toContain('for="cotia-comissaoCorretorValor"');
    expect(html).toContain('for="cotia-cartaoVistaPercentual"');
    expect(html).toMatch(/Premissa edit(?:a|á)vel/);
    expect(html).toContain("nenhuma regra é inventada");
    expect(html).toContain("Digite 0,01 para 1% e 0,005 para 0,5%");
    expect(html).toContain('data-percent-semantics="decimal-rate"');
  });

  it("adapta o decimal canônico da UI sem reinterpretar pontos percentuais persistidos", () => {
    const moduleWithAdapters = cotiaMatrixModule as typeof cotiaMatrixModule & {
      cotiaPercentPointsToDecimalInput?: (value: string) => string;
      decimalInputToCotiaPercentPoints?: (value: string) => string;
    };

    expect(moduleWithAdapters.cotiaPercentPointsToDecimalInput).toBeTypeOf("function");
    expect(moduleWithAdapters.decimalInputToCotiaPercentPoints).toBeTypeOf("function");
    expect(moduleWithAdapters.cotiaPercentPointsToDecimalInput?.("25")).toBe("0,25");
    expect(moduleWithAdapters.cotiaPercentPointsToDecimalInput?.("0,5")).toBe("0,005");
    expect(moduleWithAdapters.decimalInputToCotiaPercentPoints?.("0,25")).toBe("25");
    expect(moduleWithAdapters.decimalInputToCotiaPercentPoints?.("0.005")).toBe("0.5");
    expect(moduleWithAdapters.decimalInputToCotiaPercentPoints?.("")).toBe("");
  });

  it("sinaliza alterações Cotia ainda não registradas com CTA explícito", () => {
    const html = renderToStaticMarkup(
      <CotiaProjectMatrix
        values={{ eficiencia: "20" }}
        sourceRef="Ata 42"
        status="provided"
        {...({ dirty: true } as Record<string, unknown>)}
        onChange={() => undefined}
        onSourceChange={() => undefined}
        onStatusChange={() => undefined}
        onSave={() => undefined}
      />
    );

    expect(html).toContain("ALTERAÇÕES NÃO REGISTRADAS");
    expect(html).toContain("Registrar alterações da Página 1");
    expect(html).toContain('name="eficiencia" value="0,2"');
  });
});
