# TGR Consulting — AS-IS Proof

**Repository:** `lucastigrereal-dev/tgr-consulting`  
**Branch / base HEAD:** `codex/tgr-master-brd-v1` / `210a748fe30229b3200a7ee2650f390ebcf6a2ae`  
**Evidence date:** 2026-08-30  
**Scope:** the repository checkpoint and its extracted source only. Historical handoff material is not treated as authoritative over source code and executable tests.

## Reproducibility gate

| Check                     | Status  | Evidence                                                                                               |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| Source checkpoint present | PROVEN  | Tracked `tgr-consulting-export.zip` contains 259 application entries.                                  |
| Extracted source tree     | PROVEN  | Vite/React/TypeScript workspace, package name `igr-consulting`, pnpm lockfile.                         |
| Dependency install        | PROVEN  | `pnpm install --frozen-lockfile` completed with exit code 0 and did not change the lockfile.           |
| Type check                | PROVEN  | `pnpm run check` completed with exit code 0 after the current corrections.                             |
| Unit/component tests      | PROVEN  | Non-database tests pass; the final exact count is recorded in `TGR_FINAL_DELIVERY.md`.                 |
| Full test suite           | PARTIAL | Only the two database integration files fail, both with `Banco de dados indisponível.`                 |
| Production build          | PROVEN  | `pnpm run build` completed with exit code 0; unresolved analytics placeholders were removed.           |
| Database integration      | BLOCKED | No MySQL-compatible test service became available; MySQL and MariaDB image pulls stalled on this host. |

## Static code proof

| Claim                                     | Status     | Evidence                                                                                                                                            |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic financial engine            | PROVEN     | `shared/financial/engine.ts` exports `calculateFinancialProjection` and configures Decimal through `FinanceDecimal`.                                |
| Financial adapter                         | PROVEN     | `shared/financial/cotiaFinancialAdapter.ts` and matching test are present.                                                                          |
| Formula Registry                          | PROVEN     | `shared/financial/formulaRegistry.ts` exports `FormulaRegistry`; dedicated test is present.                                                         |
| Goal Seek V0                              | PROVEN     | `shared/financial/goalseek.ts` exports `runGoalSeek`; its test covers convergence and an unreachable target.                                        |
| Capital Envelope                          | PROVEN     | `calculateCapitalEnvelope` exists and test asserts worst accumulated cash position and headroom.                                                    |
| Impact cascade map                        | PROVEN     | `shared/financial/impactMap.ts` and dedicated test are present.                                                                                     |
| Immutable calculation snapshot            | PARTIAL    | `server/financial/snapshot.ts` and test are present; immutability requires dynamic DB/integration proof.                                            |
| Scenario branches / approvals / decisions | PARTIAL    | Schema declares `scenarioBranches`, `approvalDecisions`, `decisionRecords`, and `workflowEvents`; runtime behavior remains untested.                |
| Export implementation                     | PARTIAL    | PDF, PPTX and XLSX generators have file-level tests. Authorized DB/storage reconciliation remains untested.                                         |
| Tenant isolation / authorization          | PARTIAL    | Authorization and database integration tests are present; execution remains blocked by dependency/bootstrap and database availability.              |
| Auth / logout                             | PARTIAL    | OAuth/session infrastructure and a logout test are present; authenticated journey is not yet run.                                                   |
| Drizzle migration hygiene                 | PROVEN     | Seven imported SQL migrations exist at `drizzle/0000`–`0006`; migration `0007` adds the XLSX export enum and was generated from the current schema. |
| Boardroom / Scenario Lab UI               | PARTIAL    | Routes and pages exist, including Boardroom and Scenarios, with targeted UI tests; visual and E2E proof pending.                                    |
| Backup / restore                          | NOT_TESTED | No executed restore drill evidence in this checkout.                                                                                                |

## Initial P0

1. Reconcile the checkpoint repository shape by committing the extracted source as the actual repository tree.
2. Obtain an isolated MySQL/TiDB-compatible test runtime before claiming migration, tenant, persistence, approval or authenticated E2E proof.
3. Implement the missing product domains identified in `TGR_KNOWN_ISSUES.md`; the generic Builder records are not equivalent to a complete cohort/receivables/D90 engine.

## Next execution order

1. Commit the real source tree and current corrections on the dedicated branch.
2. Run database migrations and the two integration tests in an isolated MySQL-compatible environment.
3. Expand the financial domain in vertical slices: inventory and commercial condition, then cohorts/receivables/cancellation/delinquency/Healthy D90.
4. Execute authenticated browser E2E, visual QA, export reconciliation and restore drill before any `DONE` claim.
