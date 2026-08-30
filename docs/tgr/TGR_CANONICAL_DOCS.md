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
| Produto e jornada | `docs/igr-spec/03_PRD_V1.md`, `docs/igr-spec/19_TGR_LIVE_DOCUMENT_MODEL.md`, `docs/igr-spec/21_TGR_DOCUMENT_EXPERIENCE.md` |
| Arquitetura | `docs/igr-spec/02_ARCHITECTURE_DECISION_RECORD.md`, `docs/igr-spec/05_BLUEPRINT.md` |
| Motor e fórmulas | `shared/financial/formulas.ts`, `shared/financial/engine.ts` e respectivos testes |
| Dados e lifecycle | `drizzle/schema.ts`, `drizzle/*.sql`, `server/db.ts` e testes de integração |
| Point Economics | `shared/financial/pointEconomics.ts` e testes |
| Operação comercial | `shared/financial/commercialOperations.ts` e testes |
| E2E | `docs/tgr/TGR_E2E_MATRIX.md` |
| Segurança | `docs/tgr/TGR_SECURITY_CHECKLIST.md` |
| Operação | `docs/tgr/TGR_OPERATIONAL_RUNBOOK.md` |
| Pendências honestas | `docs/tgr/TGR_KNOWN_ISSUES.md` |
| Receipt | `docs/tgr/TGR_FINAL_DELIVERY.md` |

`docs/tgr/TGR_CODEX_ASIS_PROOF.md` preserva o ponto de partida e não descreve o estado final.
