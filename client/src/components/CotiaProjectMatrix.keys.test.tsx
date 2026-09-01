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
    expect(html).toContain("Digite 25 para 25%");
    expect(html).toContain("0,25 significa 0,25%");
    expect(html).toContain('data-percent-semantics="percentage-points"');
    expect(html).toContain('aria-describedby="cotia-eficiencia-percent-help"');
    expect(html).toContain("Deslize horizontalmente");
    expect(html).toContain("primeira coluna permanece visível");
  });

  it("converte pontos percentuais para a fração canônica sem ambiguidade", () => {
    const moduleWithAdapters = cotiaMatrixModule as typeof cotiaMatrixModule & {
      cotiaPercentPointsToDecimalRate?: (value: string) => string;
      normalizeCotiaPercentPointsInput?: (value: string) =>
        | { status: "empty" }
        | { status: "valid"; points: string; decimalRate: string }
        | { status: "invalid"; message: string };
    };

    expect(moduleWithAdapters.cotiaPercentPointsToDecimalRate).toBeTypeOf("function");
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput).toBeTypeOf("function");
    expect(moduleWithAdapters.cotiaPercentPointsToDecimalRate?.("25")).toBe("0.25");
    expect(moduleWithAdapters.cotiaPercentPointsToDecimalRate?.("0,25")).toBe("0.0025");
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput?.("25")).toEqual({
      status: "valid",
      points: "25",
      decimalRate: "0.25",
    });
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput?.("0,25")).toEqual({
      status: "valid",
      points: "0,25",
      decimalRate: "0.0025",
    });
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput?.("101")).toMatchObject({ status: "invalid" });
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput?.("-1")).toMatchObject({ status: "invalid" });
    expect(moduleWithAdapters.normalizeCotiaPercentPointsInput?.("")).toEqual({ status: "empty" });
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
    expect(html).toContain('name="eficiencia" value="20"');
  });
});
