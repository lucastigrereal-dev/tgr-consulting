import { z } from "zod";
import { FINANCIAL_INPUT_KEYS, OPTIONAL_FINANCIAL_INPUT_KEYS, type FinancialInputKey, type FinancialInputSnapshot } from "./types";

export const DecimalTextSchema = z
  .string()
  .trim()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "Use um decimal como texto, sem separador de milhar.");

export const FinancialInputSchema = z
  .object({
    status: z.enum(["provided", "pending"]),
    value: DecimalTextSchema.optional(),
    sourceType: z.enum([
      "current_decision",
      "current_document",
      "historical_primary",
      "derived_analysis",
      "external_benchmark",
      "assumption",
    ]),
    sourceRef: z.string().trim().max(500).optional(),
    updatedBy: z.string().trim().max(160).optional(),
  })
  .superRefine((input, context) => {
    if (input.status === "provided" && !input.value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Um input informado precisa de um valor decimal em texto.",
        path: ["value"],
      });
    }
    if (input.status === "pending" && input.value !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Input pendente não pode carregar valor oculto.",
        path: ["value"],
      });
    }
  });

const inputShape = Object.fromEntries(
  FINANCIAL_INPUT_KEYS.map((key) => [
    key,
    OPTIONAL_FINANCIAL_INPUT_KEYS.includes(key as never)
      ? FinancialInputSchema.optional()
      : FinancialInputSchema,
  ]),
) as unknown as Record<FinancialInputKey, z.ZodTypeAny>;

export const FinancialInputSnapshotSchema = z.object(inputShape) as unknown as z.ZodType<FinancialInputSnapshot>;

export const FinancialCalculationRequestSchema = z.object({
  horizonMonths: z.number().int().min(1).max(120),
  inputs: FinancialInputSnapshotSchema,
});

export function getPendingInputKeys(inputs: FinancialInputSnapshot): FinancialInputKey[] {
  return FINANCIAL_INPUT_KEYS.filter((key) => !OPTIONAL_FINANCIAL_INPUT_KEYS.includes(key as never) && inputs[key].status === "pending");
}
