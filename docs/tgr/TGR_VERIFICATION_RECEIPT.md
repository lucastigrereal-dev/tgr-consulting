# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-09-01
- Repositório: `lucastigrereal-dev/tgr-consulting`
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `45944bad25a8d3ba554d1095574b10beb5824c5b`
- Base desta rodada: `bd7848b3f6f8c7bbbf6142c68f4fb0cdf09f233e`
- Ambiente: Windows local, MySQL efêmero e browser Chromium/Edge headless
- Credenciais ou serviços de produção: não usados
- Merge: não executado

Este receipt é um commit documental posterior ao source head certificado. O HEAD remoto final e os checks do PR são registrados após o push.

## Resultado executivo

A rodada preservou o modelo canônico existente e acrescentou um modo financeiro explícito `HARMONY_COMPAT_V1`, separado de `TGR_CANONICAL_V2`. O Golden Natal agora é criado pela Página 1 Cotia real, calculado em 120 meses, simulado no Boardroom de `100 → 120` vendas/mês, promovido a cenário, aprovado, congelado e exportado em PDF/PPTX/XLSX sem alterar silenciosamente a baseline.

Foram também fechadas as correções pré-merge: recomputação server-side do Goal Seek, promoção de cenário com normalização do Cost Catalog, identidade de snapshot escopada por versão/horizonte/data-base e criação idempotente que reutiliza o snapshot existente sem duplicar KPI memory, workflow ou audit. A constraint `UNIQUE(snapshotHash)` foi preservada.

## Gates executados

| Comando ou prova | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — lockfile atual |
| `pnpm run check` | PASS |
| `pnpm test -- --run --reporter=dot` | PASS — 57 arquivos, 274 testes unitários/UI |
| `pnpm run test:integration:db` | PASS — 3 arquivos, 19 testes MySQL |
| testes focados Harmony/snapshot/export | PASS — 5 arquivos, 47 testes |
| revisão independente pós-fixes | PASS — 14 arquivos, 92 testes; nenhum P0/P1 restante |
| `pnpm run build` | PASS — 1.881 módulos Vite + bundle Node |
| `pnpm audit --prod --audit-level=high` | PASS — nenhuma vulnerabilidade conhecida |
| `pnpm run test:e2e:master` | PASS — Builder/Cotia real, baseline/cenário, aprovação, freeze, export, 4 viewports × 16 capítulos e 30/30 adversariais |
| `git diff --check` | PASS |

## Provas dos review threads

| Review | Prova |
| --- | --- |
| race de inputs e draft | testes focados de Cotia/Builder e suíte UI completos verdes; draft local não é sobrescrito por resposta assíncrona obsoleta |
| Goal Seek autoritativo | teste MySQL chama a rota com valores manipulados no cliente e prova recomputação server-side |
| snapshot idempotente | testes MySQL cobrem snapshot bloqueado repetido, snapshot válido repetido, mudança real de input, ausência de KPI memory duplicada e ausência de workflow/audit duplicados |

## Golden Natal — Harmony Compat V1

- Fixture: `golden/natal-harmony-master-v1.reference.json`
- Modo: `HARMONY_COMPAT_V1`
- Formula set: `1.0.0`
- Engine: `harmony-compat-engine-v1`
- Baseline: `100` vendas/mês
- Cenário aprovado: `120` vendas/mês
- snapshot baseline: `2fa8a906cae9d43250f9861c44a6234615d2358d5d0c2ae3b08dfa9dc01803cb`
- snapshot aprovado: `cdff5550a144d036ad5df81fc6427dd3bc96f45636ac057f6f5da496d00a9fa7`
- export pack: `51fb85c0a3e32f0142c12a1ab4b6940fed9a8d654ff6e99ec866554dd9c54da1`
- regressão cross-mode: `2.633 MATCH`, `2.415 MODEL_DELTA`, `0 DELTA`, `0 SOURCE_CONFLICT`

No eixo de targets do estudo, sell-out em 45 meses é `MATCH`. Capital necessário, VPL, TIR e payback permanecem `SOURCE_CONFLICT`, pois o workbook completo `COTAS_NATAL_ESTUDO_VIABILIDADE_HARMONY_MASTER_V1` não foi encontrado no material autorizado. O produto e os exports exibem essa limitação; `workbookParityClaimed=false`. Não há alegação de paridade integral com fonte ausente.

## E2E e QA visual

O E2E cria o projeto Natal pela interface real da Página 1, usa a mesma versão no cálculo e na reunião, valida estoque, entrada, parcelas, carteira, comissões, DRE, caixa e indicadores, altera a premissa para 120, prova que a versão oficial não muda antes da promoção e confere a identidade do export aprovado.

| Tela | Desktop | Mobile | Status |
| --- | --- | --- | --- |
| Página 1 Cotia / Builder | inspecionada | 375×812 inspecionada | PASS |
| Boardroom — hipótese 120 | inspecionado | inspecionado | PASS |
| Boardroom — baseline aprovado | inspecionado | inspecionado | PASS |
| PDF/PPTX/XLSX | identidade e caveat verificados | consulta funcional | PASS |

As evidências versionadas estão em `docs/tgr/evidence/harmony-compat-v1/`, incluindo seis screenshots e os três formatos exportados.

## Identidade dos artefatos

| Artefato | SHA-256 |
| --- | --- |
| Builder desktop | `41126c38601ef22ba9416b477358a11dead5b1b96aa174bcbc02b18a31d11d68` |
| Builder mobile | `9260506562e1c4005973c7481bcb84eb352640a39c1cca875b134379ad0de4c0` |
| Boardroom desktop | `bb52de4a79ef056a4f618d0338d175acfa89b0e6e45a8d9091413ac5b66a9ee0` |
| Boardroom mobile | `3951a5f2ee33b74185d2e51f6a3588c5d5a4911a36f1a3aaae659bc5e127c257` |
| Baseline aprovado desktop | `3b5d7592886514f6233e5c701e67760cd8a99d2fc958c693084de2c2f763a212` |
| Baseline aprovado mobile | `5973f559479abf49ca08350b93aa9a79acadd87e819f146e15f8b1f4ed481680` |
| PDF | `f4047d51fe90915875b8bf74e875ada7f2f0c36b86f9b70f2a7dc04ebc8b94b3` |
| PPTX | `fe9447c4dafd4751c22e5d428c66e6e5ea83daef59ef66194fa04ffd193e1eab` |
| XLSX | `d216fa017bdf490ec98604fc920bc162bbb6e81a4129b496cf6059d6a1b70278` |

## GO / NO-GO

- Demo interna do fluxo vivo: **GO**.
- Apresentação a investidor como demonstração funcional, com caveat de fonte visível: **GO CONDICIONAL**.
- Alegação de paridade integral com o workbook Harmony: **NO-GO** até a fonte completa ser fornecida e reconciliada.
- Produção: **NO-GO** até infraestrutura, autenticação, storage, observabilidade, backups e políticas financeiras definitivas serem certificados no ambiente alvo.
- Merge: **NÃO EXECUTADO E NÃO AUTORIZADO NESTA RODADA**.

**Status:** `RELEASE_CANDIDATE_LOCAL_WITH_SOURCE_CONFLICT`.
