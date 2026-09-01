import type { MeetingSimulationResult } from "@shared/financial/meetingSimulator";
import type {
  FinancialInputKey,
  FinancialInputSnapshot,
} from "@shared/financial/types";

const SIMULATED_VALUES = {
  qualifiedCouplesMonth1: (result: MeetingSimulationResult) => result.after.qualifiedCouplesMonth1,
  payrollMonthly: (result: MeetingSimulationResult) => result.after.payrollMonthly,
  averageTicket: (result: MeetingSimulationResult) => result.after.averageTicket,
  fixedCostMonthly: (result: MeetingSimulationResult) => result.after.fixedCostMonthly,
  variableCostRate: (result: MeetingSimulationResult) => result.after.variableCostRate,
  capexInitial: (result: MeetingSimulationResult) => result.after.capexInitial,
} satisfies Partial<Record<FinancialInputKey, (result: MeetingSimulationResult) => string>>;

function decimalEquals(left: string | undefined, right: string) {
  if (left === undefined) return false;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
}

export function buildMeetingScenarioInputs(
  baseInputs: FinancialInputSnapshot,
  result: MeetingSimulationResult
) {
  const inputs = structuredClone(baseInputs);
  const changedKeys: FinancialInputKey[] = [];

  for (const [key, readValue] of Object.entries(SIMULATED_VALUES) as Array<[
    FinancialInputKey,
    (result: MeetingSimulationResult) => string,
  ]>) {
    const value = readValue(result);
    if (decimalEquals(baseInputs[key]?.value, value)) continue;
    inputs[key] = {
      status: "provided",
      value,
      sourceType: "current_decision",
      sourceRef: "boardroom",
    };
    changedKeys.push(key);
  }

  return { inputs, changedKeys };
}

export function calculateMeetingDelta(
  current: string | null | undefined,
  previous: string | null | undefined
) {
  const currentNumber = current === null || current === undefined ? NaN : Number(current);
  const previousNumber = previous === null || previous === undefined ? NaN : Number(previous);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) {
    return { absolute: null, percent: null };
  }
  const absolute = currentNumber - previousNumber;
  return {
    absolute,
    percent: previousNumber === 0 ? null : (absolute / Math.abs(previousNumber)) * 100,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

export function meetingSimulationSignature(payload: Record<string, unknown>) {
  return JSON.stringify(stableValue(payload));
}

export function isLatestMeetingResponse(
  requestId: number,
  currentRequestId: number,
  responseSignature: string,
  currentSignature: string
) {
  return requestId === currentRequestId && responseSignature === currentSignature;
}

export function isCurrentMeetingHypothesis(
  status: "idle" | "calculating" | "current",
  resultSignature: string,
  currentSignature: string
) {
  return status === "current" && Boolean(resultSignature) && resultSignature === currentSignature;
}

export function isCurrentMeetingActionGeneration(
  actionGeneration: number,
  currentGeneration: number
) {
  return actionGeneration === currentGeneration;
}
