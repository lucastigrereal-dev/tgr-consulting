import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import { normalizeDecimalInput } from "@/lib/financialPresentation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  AlertTriangle,
  Boxes,
  Calculator,
  CirclePlus,
  Save,
  Trash2,
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Status = "provided" | "pending";
type SourceType =
  | "current_decision"
  | "current_document"
  | "historical_primary"
  | "derived_analysis"
  | "external_benchmark"
  | "assumption";

type PricePhaseDraft = {
  id: string;
  startsAtMonth: string;
  price: string;
};

type SkuDraft = {
  id: string;
  name: string;
  unitType: string;
  unitQuantity: string;
  sharesPerUnit: string;
  grossSoldShares: string;
  returnedShares: string;
  blockedShares: string;
  status: Status;
  sourceType: SourceType;
  sourceRef: string;
  pricePhases: PricePhaseDraft[];
};

type ConditionDraft = {
  id: string;
  name: string;
  listPrice: string;
  discount: string;
  entryTotal: string;
  entryInstallments: string;
  entryFirstDueMonth: string;
  balancePrincipal: string;
  balanceInstallments: string;
  graceMonths: string;
  balanceFirstDueMonth: string;
  explicitCharges: string;
  correctionRate: string;
  interestRate: string;
  materialityTolerance: string;
  campaign: string;
  status: Status;
  sourceType: SourceType;
  sourceRef: string;
};

type CommercialDraft = {
  sku: SkuDraft;
  condition: ConditionDraft;
};

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ProductCatalog = RouterOutputs["igr"]["productCatalog"];
type CommercialConditions = RouterOutputs["igr"]["commercialConditions"];

const inputClassName = "h-9 bg-background";
const decimalPattern = "(?:0|[1-9]\\d*)(?:\\.\\d+)?";
const integerPattern = "\\d+";

const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function emptyCondition(skuCode: string): ConditionDraft {
  return {
    id: `standard-${skuCode}`,
    name: "Condição padrão",
    listPrice: "0",
    discount: "0",
    entryTotal: "0",
    entryInstallments: "1",
    entryFirstDueMonth: "0",
    balancePrincipal: "0",
    balanceInstallments: "1",
    graceMonths: "0",
    balanceFirstDueMonth: "1",
    explicitCharges: "0",
    correctionRate: "0",
    interestRate: "0",
    materialityTolerance: "0.01",
    campaign: "",
    status: "pending",
    sourceType: "current_decision",
    sourceRef: "",
  };
}

function emptyCommercialDraft(index: number): CommercialDraft {
  const skuCode = `sku-${index}`;
  return {
    sku: {
      id: skuCode,
      name: `Produto ${index}`,
      unitType: "unidade",
      unitQuantity: "0",
      sharesPerUnit: "1",
      grossSoldShares: "0",
      returnedShares: "0",
      blockedShares: "0",
      status: "pending",
      sourceType: "current_decision",
      sourceRef: "",
      pricePhases: [{ id: "base", startsAtMonth: "0", price: "0" }],
    },
    condition: emptyCondition(skuCode),
  };
}

function toInteger(value: string, field: string) {
  if (!/^\d+$/.test(value))
    throw new Error(`${field} deve ser um inteiro não negativo.`);
  return Number(value);
}

function readDrafts(
  catalog: ProductCatalog | undefined,
  commercialConditions: CommercialConditions | undefined
): CommercialDraft[] {
  if (!catalog?.records) return [];
  return catalog.records.map(record => {
    const saved = commercialConditions?.find(
      item => item.productSkuCode === record.skuCode
    );
    const condition = saved?.condition;
    return {
      sku: {
        id: record.skuCode,
        name: record.name,
        unitType: record.unitType,
        unitQuantity: String(record.unitQuantity),
        sharesPerUnit: String(record.sharesPerUnit),
        grossSoldShares: String(record.grossSoldShares),
        returnedShares: String(record.returnedShares),
        blockedShares: String(record.blockedShares),
        status: record.status,
        sourceType: record.sourceType,
        sourceRef: record.sourceRef ?? "",
        pricePhases: record.pricePhases.map(phase => ({
          id: phase.phaseCode,
          startsAtMonth: String(phase.startsAtMonth),
          price: phase.promotionalPriceText ?? phase.priceText,
        })),
      },
      condition: condition
        ? {
            id: condition.id,
            name: condition.name,
            listPrice: condition.listPrice,
            discount: condition.discount,
            entryTotal: condition.entry.total,
            entryInstallments: String(condition.entry.installments),
            entryFirstDueMonth: String(condition.entry.firstDueMonth),
            balancePrincipal: condition.balance.principal,
            balanceInstallments: String(condition.balance.installments),
            graceMonths: String(condition.balance.graceMonths),
            balanceFirstDueMonth: String(condition.balance.firstDueMonth),
            explicitCharges: condition.explicitCharges,
            correctionRate: condition.correctionRate ?? "0",
            interestRate: condition.interestRate ?? "0",
            materialityTolerance: condition.materialityTolerance,
            campaign: condition.campaign ?? "",
            status: saved.record.status,
            sourceType: saved.record.sourceType,
            sourceRef: saved.record.sourceRef ?? "",
          }
        : emptyCondition(record.skuCode),
    };
  });
}

function Field({
  id,
  label,
  value,
  onChange,
  inputMode,
  pattern,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
  pattern?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        className={inputClassName}
        value={value}
        onChange={event =>
          onChange(
            inputMode === "decimal"
              ? normalizeDecimalInput(event.target.value)
              : event.target.value
          )
        }
        inputMode={inputMode}
        pattern={pattern}
        disabled={disabled}
      />
    </div>
  );
}

export function AuthoritativeCommercialBuilder({
  versionId,
}: {
  versionId: string;
}) {
  const utils = trpc.useUtils();
  const [asOfMonth, setAsOfMonth] = useState("0");
  const [horizonMonths, setHorizonMonths] = useState("120");
  const referenceMonth = /^\d+$/.test(asOfMonth) ? Number(asOfMonth) : 0;
  const catalogQuery = trpc.igr.productCatalog.useQuery(
    { versionId: versionId || "placeholder", asOfMonth: referenceMonth },
    { enabled: Boolean(versionId), retry: false }
  );
  const conditionsQuery = trpc.igr.commercialConditions.useQuery(
    { versionId: versionId || "placeholder" },
    { enabled: Boolean(versionId), retry: false }
  );
  const initialDrafts = readDrafts(catalogQuery.data, conditionsQuery.data);
  const [drafts, setDrafts] = useState<CommercialDraft[]>(initialDrafts);
  const hydratedSignature = useRef("");

  useEffect(() => {
    if (!catalogQuery.data || !conditionsQuery.data) return;
    const signature = JSON.stringify([
      catalogQuery.data.records,
      conditionsQuery.data,
    ]);
    if (signature === hydratedSignature.current) return;
    hydratedSignature.current = signature;
    setDrafts(readDrafts(catalogQuery.data, conditionsQuery.data));
  }, [catalogQuery.data, conditionsQuery.data]);

  const replaceCatalog = trpc.igr.replaceProductCatalog.useMutation();
  const upsertCondition = trpc.igr.upsertCommercialCondition.useMutation();
  const calculate = trpc.igr.calculate.useMutation();
  const isSaving =
    replaceCatalog.isPending ||
    upsertCondition.isPending ||
    calculate.isPending;

  const blockers = useMemo(() => {
    const product = catalogQuery.data?.evaluation.violations ?? [];
    const commercial = (conditionsQuery.data ?? []).flatMap(item =>
      item.reconciliation.violations.map(violation => ({
        ...violation,
        path: `${item.productSkuCode ?? "sem SKU"} · ${violation.path ?? "condição"}`,
      }))
    );
    return [...product, ...commercial];
  }, [catalogQuery.data, conditionsQuery.data]);
  const pendingCount = drafts.filter(
    draft => draft.sku.status === "pending" || draft.condition.status === "pending"
  ).length;
  const persistedSkuCodes = new Set(
    catalogQuery.data?.records.map(record => record.skuCode) ?? []
  );
  const linkedSkuCodes = new Set(
    (conditionsQuery.data ?? [])
      .map(item => item.productSkuCode)
      .filter((code): code is string => Boolean(code))
  );

  const patchSku = (index: number, patch: Partial<SkuDraft>) =>
    setDrafts(current =>
      current.map((draft, position) =>
        position === index
          ? { ...draft, sku: { ...draft.sku, ...patch } }
          : draft
      )
    );

  const patchCondition = (index: number, patch: Partial<ConditionDraft>) =>
    setDrafts(current =>
      current.map((draft, position) =>
        position === index
          ? { ...draft, condition: { ...draft.condition, ...patch } }
          : draft
      )
    );

  const patchPhase = (
    skuIndex: number,
    phaseIndex: number,
    patch: Partial<PricePhaseDraft>
  ) =>
    setDrafts(current =>
      current.map((draft, position) =>
        position !== skuIndex
          ? draft
          : {
              ...draft,
              sku: {
                ...draft.sku,
                pricePhases: draft.sku.pricePhases.map(
                  (phase, phasePosition) =>
                    phasePosition === phaseIndex
                      ? { ...phase, ...patch }
                      : phase
                ),
              },
            }
      )
    );

  const save = async (andCalculate: boolean) => {
    if (!versionId)
      return toast.error("Selecione uma versão de trabalho antes de salvar.");
    if (!drafts.length)
      return toast.error("Adicione ao menos um SKU ao catálogo.");
    let catalogSaved = false;
    try {
      const parsedAsOfMonth = toInteger(asOfMonth, "Mês de referência");
      const parsedHorizon = toInteger(horizonMonths, "Horizonte");
      if (parsedHorizon < 1 || parsedHorizon > 120)
        throw new Error("Horizonte deve ficar entre 1 e 120 meses.");
      for (const { sku, condition } of drafts) {
        if (sku.status === "provided" && !sku.sourceRef.trim())
          throw new Error(`Informe a fonte ou responsável do SKU ${sku.name}.`);
        if (condition.status === "provided" && !condition.sourceRef.trim())
          throw new Error(
            `Informe a fonte ou responsável da condição de ${sku.name}.`
          );
      }

      await replaceCatalog.mutateAsync({
        versionId,
        asOfMonth: parsedAsOfMonth,
        skus: drafts.map(({ sku }) => ({
          id: sku.id.trim(),
          name: sku.name.trim(),
          unitType: sku.unitType.trim(),
          unitQuantity: toInteger(sku.unitQuantity, `Unidades de ${sku.name}`),
          sharesPerUnit: toInteger(
            sku.sharesPerUnit,
            `Cotas por unidade de ${sku.name}`
          ),
          grossSoldShares: toInteger(
            sku.grossSoldShares,
            `Vendas brutas de ${sku.name}`
          ),
          returnedShares: toInteger(
            sku.returnedShares,
            `Devoluções de ${sku.name}`
          ),
          blockedShares: toInteger(
            sku.blockedShares,
            `Bloqueios de ${sku.name}`
          ),
          status: sku.status,
          sourceType: sku.sourceType,
          sourceRef: sku.sourceRef.trim() || undefined,
          pricePhases: sku.pricePhases.map(phase => ({
            id: phase.id.trim(),
            startsAtMonth: toInteger(
              phase.startsAtMonth,
              `Mês da fase ${phase.id}`
            ),
            price: phase.price,
          })),
        })),
      });
      catalogSaved = true;

      for (const { sku, condition } of drafts) {
        await upsertCondition.mutateAsync({
          versionId,
          productSkuCode: sku.id.trim(),
          status: condition.status,
          sourceType: condition.sourceType,
          sourceRef: condition.sourceRef.trim() || undefined,
          condition: {
            id: condition.id.trim(),
            name: condition.name.trim(),
            listPrice: condition.listPrice,
            discount: condition.discount,
            entry: {
              total: condition.entryTotal,
              installments: toInteger(
                condition.entryInstallments,
                "Parcelas da entrada"
              ),
              firstDueMonth: toInteger(
                condition.entryFirstDueMonth,
                "Primeiro vencimento da entrada"
              ),
            },
            balance: {
              principal: condition.balancePrincipal,
              installments: toInteger(
                condition.balanceInstallments,
                "Parcelas do saldo"
              ),
              graceMonths: toInteger(condition.graceMonths, "Carência"),
              firstDueMonth: toInteger(
                condition.balanceFirstDueMonth,
                "Primeiro vencimento do saldo"
              ),
            },
            explicitCharges: condition.explicitCharges,
            correctionRate: condition.correctionRate || undefined,
            interestRate: condition.interestRate || undefined,
            materialityTolerance: condition.materialityTolerance,
            campaign: condition.campaign.trim() || undefined,
          },
        });
      }

      await Promise.all([
        utils.igr.productCatalog.invalidate(),
        utils.igr.commercialConditions.invalidate(),
      ]);
      if (!andCalculate) {
        toast.success("Produto e condições comerciais salvos.", {
          description:
            "Estoque, fases, proveniência e reconciliação foram atualizados.",
        });
        return;
      }
      const snapshot = await calculate.mutateAsync({
        versionId,
        horizonMonths: parsedHorizon,
        asOfMonth: parsedAsOfMonth,
      });
      await Promise.all([
        utils.igr.projectContext.invalidate(),
        utils.igr.scenarioComparison.invalidate(),
      ]);
      if (snapshot.status === "valid")
        toast.success("Catálogo salvo e snapshot calculado.", {
          description: `Hash ${snapshot.snapshotHash.slice(0, 12).toUpperCase()}`,
        });
      else
        toast.warning("Catálogo salvo; snapshot ainda bloqueado.", {
          description:
            "Revise as pendências autoritativas indicadas pelo cálculo.",
        });
    } catch (error) {
      if (catalogSaved) {
        await Promise.all([
          utils.igr.productCatalog.invalidate(),
          utils.igr.commercialConditions.invalidate(),
        ]);
      }
      toast.error("Não foi possível concluir o fluxo comercial.", {
        description:
          `${catalogSaved ? "O catálogo foi salvo, mas as condições ficaram parciais. Recarregue e tente novamente. " : ""}${error instanceof Error ? error.message : "Erro não identificado."}`,
      });
    }
  };

  if (!versionId)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Boxes />
          </EmptyMedia>
          <EmptyTitle>Selecione um projeto</EmptyTitle>
          <EmptyDescription>
            O catálogo comercial pertence à versão de trabalho ativa.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  if (catalogQuery.isLoading || conditionsQuery.isLoading)
    return (
      <div
        className="flex min-h-44 items-center justify-center gap-3 rounded-xl border bg-card"
        role="status"
        aria-live="polite"
      >
        <Spinner aria-hidden="true" />
        <span className="text-sm text-muted-foreground">
          Carregando produto e condições comerciais…
        </span>
      </div>
    );

  if (catalogQuery.isError || conditionsQuery.isError)
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Não foi possível carregar o domínio comercial</AlertTitle>
        <AlertDescription>
          {catalogQuery.error?.message ??
            conditionsQuery.error?.message ??
            "Tente novamente."}
        </AlertDescription>
      </Alert>
    );

  return (
    <section className="space-y-5" aria-labelledby="commercial-builder-title">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline">Motor autoritativo</Badge>
            <Badge variant={blockers.length || pendingCount ? "destructive" : "secondary"}>
              {blockers.length
                ? `${blockers.length} bloqueio(s)`
                : pendingCount
                  ? `${pendingCount} item(ns) pendente(s)`
                : "Reconciliado"}
            </Badge>
          </div>
          <h2
            id="commercial-builder-title"
            className="text-xl font-semibold tracking-tight"
          >
            Produto e condição comercial autoritativos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estoque, preço vigente e entrada deste cadastro alimentam
            diretamente o snapshot financeiro.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="commercial-as-of"
            label="Mês de referência"
            value={asOfMonth}
            onChange={setAsOfMonth}
            inputMode="numeric"
            pattern={integerPattern}
          />
          <Field
            id="commercial-horizon"
            label="Horizonte (meses)"
            value={horizonMonths}
            onChange={setHorizonMonths}
            inputMode="numeric"
            pattern={integerPattern}
          />
        </div>
      </div>

      {blockers.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Bloqueios do snapshot oficial</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {blockers.map((blocker, index) => (
                <li key={`${blocker.code}-${index}`}>
                  <span className="font-medium">{blocker.code}</span>:{" "}
                  {blocker.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {!drafts.length ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Boxes />
            </EmptyMedia>
            <EmptyTitle>Nenhum SKU cadastrado</EmptyTitle>
            <EmptyDescription>
              Comece pelo produto comercializável. O primeiro preço precisa
              valer no mês de referência.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setDrafts([emptyCommercialDraft(1)])}>
              <CirclePlus /> Adicionar primeiro SKU
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {drafts.map(({ sku, condition }, index) => (
            <Card key={`${sku.id}-${index}`} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {sku.name || `SKU ${index + 1}`}
                    </CardTitle>
                    <CardDescription>
                      {sku.id || "Código ainda não informado"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${sku.name || `SKU ${index + 1}`}`}
                    onClick={() =>
                      setDrafts(current =>
                        current.filter((_, position) => position !== index)
                      )
                    }
                    disabled={linkedSkuCodes.has(sku.id)}
                    title={linkedSkuCodes.has(sku.id) ? "Remova ou desvincule a condição comercial antes de excluir este SKU." : undefined}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-5">
                <fieldset className="space-y-3">
                  <legend className="text-sm font-semibold">
                    Produto e estoque
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id={`sku-${index}-code`}
                      label="Código do SKU"
                      value={sku.id}
                      onChange={value => {
                        patchSku(index, { id: value });
                        if (condition.id.startsWith("standard-"))
                          patchCondition(index, { id: `standard-${value}` });
                      }}
                      disabled={persistedSkuCodes.has(sku.id)}
                    />
                    <Field
                      id={`sku-${index}-name`}
                      label="Nome"
                      value={sku.name}
                      onChange={value => patchSku(index, { name: value })}
                    />
                    <Field
                      id={`sku-${index}-unit-type`}
                      label="Tipo de unidade"
                      value={sku.unitType}
                      onChange={value => patchSku(index, { unitType: value })}
                    />
                    <Field
                      id={`sku-${index}-units`}
                      label="Unidades"
                      value={sku.unitQuantity}
                      onChange={value =>
                        patchSku(index, { unitQuantity: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`sku-${index}-shares`}
                      label="Cotas por unidade"
                      value={sku.sharesPerUnit}
                      onChange={value =>
                        patchSku(index, { sharesPerUnit: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`sku-${index}-sold`}
                      label="Cotas vendidas (bruto)"
                      value={sku.grossSoldShares}
                      onChange={value =>
                        patchSku(index, { grossSoldShares: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`sku-${index}-returned`}
                      label="Cotas devolvidas"
                      value={sku.returnedShares}
                      onChange={value =>
                        patchSku(index, { returnedShares: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`sku-${index}-blocked`}
                      label="Cotas bloqueadas"
                      value={sku.blockedShares}
                      onChange={value =>
                        patchSku(index, { blockedShares: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`sku-${index}-status`}
                        className="text-xs text-muted-foreground"
                      >
                        Estado
                      </Label>
                      <select
                        id={`sku-${index}-status`}
                        className={`${inputClassName} w-full rounded-md border px-3 text-sm`}
                        value={sku.status}
                        onChange={event =>
                          patchSku(index, {
                            status: event.target.value as Status,
                          })
                        }
                      >
                        <option value="provided">Informado</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>
                    <Field
                      id={`sku-${index}-source`}
                      label="Fonte ou responsável"
                      value={sku.sourceRef}
                      onChange={value => patchSku(index, { sourceRef: value })}
                    />
                  </div>
                </fieldset>

                <Accordion type="single" collapsible>
                  <AccordionItem value="prices">
                    <AccordionTrigger>
                      Fases de preço ({sku.pricePhases.length})
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {sku.pricePhases.map((phase, phaseIndex) => (
                        <div
                          key={`${phase.id}-${phaseIndex}`}
                          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_7rem_1fr_auto] sm:items-end"
                        >
                          <Field
                            id={`sku-${index}-phase-${phaseIndex}-id`}
                            label="Código"
                            value={phase.id}
                            onChange={value =>
                              patchPhase(index, phaseIndex, { id: value })
                            }
                          />
                          <Field
                            id={`sku-${index}-phase-${phaseIndex}-month`}
                            label="Início (mês)"
                            value={phase.startsAtMonth}
                            onChange={value =>
                              patchPhase(index, phaseIndex, {
                                startsAtMonth: value,
                              })
                            }
                            inputMode="numeric"
                            pattern={integerPattern}
                          />
                          <Field
                            id={`sku-${index}-phase-${phaseIndex}-price`}
                            label="Preço"
                            value={phase.price}
                            onChange={value =>
                              patchPhase(index, phaseIndex, { price: value })
                            }
                            inputMode="decimal"
                            pattern={decimalPattern}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover fase ${phase.id}`}
                            disabled={sku.pricePhases.length === 1}
                            onClick={() =>
                              patchSku(index, {
                                pricePhases: sku.pricePhases.filter(
                                  (_, position) => position !== phaseIndex
                                ),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchSku(index, {
                            pricePhases: [
                              ...sku.pricePhases,
                              {
                                id: uniqueId("fase"),
                                startsAtMonth: asOfMonth,
                                price: "0",
                              },
                            ],
                          })
                        }
                      >
                        <CirclePlus /> Adicionar fase
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <fieldset className="space-y-3 border-t pt-5">
                  <legend className="text-sm font-semibold">
                    Condição comercial do SKU
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id={`condition-${index}-id`}
                      label="Código da condição"
                      value={condition.id}
                      onChange={value => patchCondition(index, { id: value })}
                    />
                    <Field
                      id={`condition-${index}-name`}
                      label="Nome"
                      value={condition.name}
                      onChange={value => patchCondition(index, { name: value })}
                    />
                    <Field
                      id={`condition-${index}-list-price`}
                      label="Preço de tabela"
                      value={condition.listPrice}
                      onChange={value =>
                        patchCondition(index, { listPrice: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-discount`}
                      label="Desconto nominal"
                      value={condition.discount}
                      onChange={value =>
                        patchCondition(index, { discount: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-entry`}
                      label="Entrada total"
                      value={condition.entryTotal}
                      onChange={value =>
                        patchCondition(index, { entryTotal: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-entry-installments`}
                      label="Parcelas da entrada"
                      value={condition.entryInstallments}
                      onChange={value =>
                        patchCondition(index, { entryInstallments: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`condition-${index}-entry-first`}
                      label="1º vencimento da entrada"
                      value={condition.entryFirstDueMonth}
                      onChange={value =>
                        patchCondition(index, { entryFirstDueMonth: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`condition-${index}-principal`}
                      label="Principal do saldo"
                      value={condition.balancePrincipal}
                      onChange={value =>
                        patchCondition(index, { balancePrincipal: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-balance-installments`}
                      label="Parcelas do saldo"
                      value={condition.balanceInstallments}
                      onChange={value =>
                        patchCondition(index, { balanceInstallments: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`condition-${index}-grace`}
                      label="Carência (meses)"
                      value={condition.graceMonths}
                      onChange={value =>
                        patchCondition(index, { graceMonths: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`condition-${index}-balance-first`}
                      label="1º vencimento do saldo"
                      value={condition.balanceFirstDueMonth}
                      onChange={value =>
                        patchCondition(index, { balanceFirstDueMonth: value })
                      }
                      inputMode="numeric"
                      pattern={integerPattern}
                    />
                    <Field
                      id={`condition-${index}-charges`}
                      label="Encargos explícitos"
                      value={condition.explicitCharges}
                      onChange={value =>
                        patchCondition(index, { explicitCharges: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-correction`}
                      label="Correção (decimal)"
                      value={condition.correctionRate}
                      onChange={value =>
                        patchCondition(index, { correctionRate: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-interest`}
                      label="Juros (decimal)"
                      value={condition.interestRate}
                      onChange={value =>
                        patchCondition(index, { interestRate: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-tolerance`}
                      label="Tolerância de reconciliação"
                      value={condition.materialityTolerance}
                      onChange={value =>
                        patchCondition(index, { materialityTolerance: value })
                      }
                      inputMode="decimal"
                      pattern={decimalPattern}
                    />
                    <Field
                      id={`condition-${index}-campaign`}
                      label="Campanha (opcional)"
                      value={condition.campaign}
                      onChange={value =>
                        patchCondition(index, { campaign: value })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`condition-${index}-status`}
                        className="text-xs text-muted-foreground"
                      >
                        Estado
                      </Label>
                      <select
                        id={`condition-${index}-status`}
                        className={`${inputClassName} w-full rounded-md border px-3 text-sm`}
                        value={condition.status}
                        onChange={event =>
                          patchCondition(index, {
                            status: event.target.value as Status,
                          })
                        }
                      >
                        <option value="provided">Informada</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>
                    <Field
                      id={`condition-${index}-source`}
                      label="Fonte ou responsável"
                      value={condition.sourceRef}
                      onChange={value =>
                        patchCondition(index, { sourceRef: value })
                      }
                    />
                  </div>
                </fieldset>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() =>
            setDrafts(current => [
              ...current,
              emptyCommercialDraft(current.length + 1),
            ])
          }
          disabled={isSaving}
        >
          <CirclePlus /> Adicionar SKU
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void save(false)}
            disabled={isSaving || !drafts.length}
          >
            {replaceCatalog.isPending || upsertCondition.isPending ? (
              <Spinner />
            ) : (
              <Save />
            )}
            Salvar
          </Button>
          <Button
            onClick={() => void save(true)}
            disabled={isSaving || !drafts.length || pendingCount > 0}
          >
            {calculate.isPending ? <Spinner /> : <Calculator />}
            Salvar e calcular
          </Button>
        </div>
      </div>
    </section>
  );
}

export default AuthoritativeCommercialBuilder;
