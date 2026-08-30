import { FINANCIAL_INPUT_KEYS, type FinancialInputSnapshot } from "./types";

/**
 * Seed de entrada para Natal. Não representa forecast e não inventa premissas:
 * enquanto a fonte canônica não entregar valores aprovados, o motor deve bloquear
 * qualquer snapshot autoritativo que dependa deste conjunto.
 */
export const NATAL_PENDING_SEED = Object.fromEntries(
  FINANCIAL_INPUT_KEYS.map(key => [
    key,
    { status: "pending", sourceType: "current_document", sourceRef: "HANDOFF_MESTRE_COTAS_NATAL" },
  ])
) as FinancialInputSnapshot;
