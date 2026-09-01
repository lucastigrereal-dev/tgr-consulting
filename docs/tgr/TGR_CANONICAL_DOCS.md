# TGR Consulting — Índice documental canônico

## Hierarquia de autoridade

1. código executável, migrations e testes do repositório;
2. BRD mestre desta rodada para intenção de produto;
3. documentos abaixo para operação e contexto;
4. relatórios AS-IS históricos apenas como evidência datada.

Em caso de divergência, não se corrige cálculo por texto: primeiro se cria um teste vermelho e se reconcilia o contrato.

## Mapa

| Tema | Autoridade no repositório |
| --- | --- |
| Produto e jornada | `docs/tgr/TGR_PRODUCT_BRD.md` |
| Arquitetura | `docs/tgr/TGR_ARCHITECTURE.md` |
| Motor e fórmulas | `docs/tgr/TGR_FORMULA_REGISTRY.md`, `shared/financial/formulas.ts`, `shared/financial/engine.ts` e respectivos testes |
| Dados e lifecycle | `docs/tgr/TGR_DATA_MODEL.md`, `drizzle/schema.ts`, `drizzle/*.sql`, `server/db.ts` e testes de integração |
| Point Economics | `shared/financial/pointEconomics.ts` e testes |
| Operação comercial | `shared/financial/commercialOperations.ts` e testes |
| E2E | `docs/tgr/TGR_E2E_MATRIX.md` |
| Segurança | `docs/tgr/TGR_SECURITY.md`, `docs/tgr/TGR_SECURITY_CHECKLIST.md` |
| Operação | `docs/tgr/TGR_RUNBOOK.md`, `docs/tgr/TGR_OPERATIONAL_RUNBOOK.md` |
| Evidência de certificação | `docs/tgr/TGR_VERIFICATION_RECEIPT.md` |
| Pendências honestas | `docs/tgr/TGR_KNOWN_ISSUES.md` |
| Receipt | `docs/tgr/TGR_FINAL_DELIVERY.md` |

`docs/tgr/TGR_CODEX_ASIS_PROOF.md` preserva o ponto de partida e não descreve o estado final.
