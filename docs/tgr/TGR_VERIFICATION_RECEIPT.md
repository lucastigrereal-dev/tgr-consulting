# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-09-01
- Repositório: `lucastigrereal-dev/tgr-consulting`
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `a2f986e032419d318bb6266210fa1c12888d4321`
- Base desta rodada: `587dcaa7661ee86f2349db5419fd093bb5d9bfe1`
- Ambiente: Windows local, MySQL 8.4 efêmero e Microsoft Edge headless
- Credenciais ou serviços de produção: não usados
- Merge: não executado

Este receipt é um commit documental posterior ao source head certificado. O HEAD remoto final e os checks do PR são confirmados após o push.

## Resultado executivo

O fixture provisório foi substituído pelo Golden canônico reconstruído de `COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json`. `HARMONY_COMPAT_V1` agora calcula os 144 meses, preserva o modo `TGR_CANONICAL_V2` e reconcilia os cenários de R$ 28 mil, R$ 35 mil e R$ 40 mil com delta zero na precisão publicada.

O único conflito interno mantido é `SC-001`: o cronograma usa 4.457 vendas brutas (`44×100 + 57`) e a linha indicadora publicada registra 4.458. Essa diferença permanece explícita na engine, UI, fixture, matriz e exports; não houve calibração silenciosa.

## Gates executados

| Comando ou prova | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — lockfile atual |
| `pnpm run check` | PASS |
| `pnpm test -- --run --reporter=dot` | PASS — 58 arquivos, 282 testes unitários/UI |
| `pnpm run test:integration:db` | PASS — 3 arquivos, 19 testes MySQL |
| testes focados Harmony/export/UI | PASS — 5 arquivos, 56 testes |
| `pnpm run build` | PASS — 1.881 módulos Vite + bundle Node |
| `pnpm audit --prod --audit-level=high` | PASS — nenhuma vulnerabilidade conhecida |
| `pnpm run test:e2e:master` | PASS — Golden 144 meses, Builder, Boardroom, baseline/cenário, aprovação, freeze, export, 4 viewports × 16 capítulos e 30/30 adversariais |
| `git diff --check` | PASS após normalização do documento da matriz |

## Golden Natal — Harmony Compat V1

- Fixture: `golden/natal-harmony-master-v1.reference.json`
- Matriz: `docs/tgr/golden/HARMONY_TGR_MATRIX_V1.md`
- Modo: `HARMONY_COMPAT_V1`
- Horizonte: 144 meses
- Formula Set: `1.0.0`
- Engine: `harmony-compat-engine-v1`
- Autoridade: `CANONICAL_FROM_HARMONY_MASTER_V1`
- Fonte: `docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json`
- snapshot baseline E2E: `6ff9e9a081edcfc71843fdd64e31526d11b721bbe3fe5964aa93b09813bc30c5`
- snapshot aprovado E2E: `43318f57675ae82fa0d6005a27e08ed2671a4458e3c5677f6d15dac078cbe3bd`
- export pack E2E: `a71543b57e2f339eea210b6559246b5df2bb9efd2f841bcd73dfef495b71edef`
- regressão cross-mode por cenário: `2.583 MATCH`, `2.465 MODEL_DELTA`, `0 DELTA`, `0 SOURCE_CONFLICT cross-mode`

| Cenário | Capital | VPL 18% a.a. | TIR anual | Payback | VGV | Delta publicado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| R$ 28 mil | R$ 1.791.990 | R$ 21.612.036 | 130,8% | 25 meses | R$ 87.360.000 | 0 |
| R$ 35 mil | R$ 1.756.526 | R$ 30.063.688 | 168,7% | 21 meses | R$ 109.200.000 | 0 |
| R$ 40 mil | R$ 1.733.413 | R$ 36.100.582 | 195,2% | 20 meses | R$ 124.800.000 | 0 |

## E2E e QA visual

O E2E cria o projeto Natal pela Página 1, calcula o Golden canônico, altera a premissa de 100 para 120 vendas/mês, prova que a versão oficial não muda antes da promoção, aprova e congela o cenário e confere a identidade do export aprovado. O caminho longo da fonte canônica foi corrigido para não provocar overflow no Boardroom mobile.

| Tela | Desktop | Mobile | Status |
| --- | --- | --- | --- |
| Página 1 Cotia / Builder | inspecionada | 375×812 inspecionada | PASS |
| Boardroom — hipótese 120 | inspecionado | sem overflow horizontal | PASS |
| Boardroom — baseline aprovado | inspecionado | inspecionado | PASS |
| PDF/PPTX/XLSX | provenance e `SC-001` verificados | consulta funcional | PASS |

As evidências versionadas estão em `docs/tgr/evidence/harmony-compat-v1/`, incluindo seis screenshots e os três formatos exportados.

## Identidade dos artefatos

| Artefato | SHA-256 |
| --- | --- |
| Builder desktop | `48d1ff3caa1edf9adf8b92c531076720ad5cef936fe4c233d514f0e23081704c` |
| Builder mobile | `949fafad7d489d4b02ef7a2a1a065b78365ca7ac36f024d885e6e34c2fbae1fe` |
| Boardroom desktop | `7b8ff34b448d8c5eee0687e693f6250ede0f8d2b2f69b6aef7ab047873034abd` |
| Boardroom mobile | `a6ea5cd38754a81aa9ea865a760f9629761ee472b93c83846c31d87046800691` |
| Baseline aprovado desktop | `e3e69741e173c23ea740eb145559cb76770d3fa5c9b3aad774ad9e5b2f202f11` |
| Baseline aprovado mobile | `8609c260e1e70971231d19f5f218fe6ebf1e652787b2ca80c3320cb660051661` |
| PDF | `8b2389552f4fafcc901d29286cf19341aedefe7401d9a7edffad9e1cab4c0632` |
| PPTX | `6bfa20e5be1eafa258ae9a19b997d5acbb556ba4cc6bf675c3e13a7f620a6082` |
| XLSX | `f25ad0047c655d3a1cf29a693aa25a62eeb11d8471ec08481e1e317b878b0f4b` |

## GO / NO-GO

- Demo interna do fluxo vivo: **GO**.
- Apresentação a investidor como demonstração funcional do Golden Harmony: **GO**, preservando `SC-001` visível.
- Paridade dos valores publicados nos três cenários: **GO**.
- Produção: **NO-GO** até infraestrutura, autenticação, storage, observabilidade, backups e políticas financeiras definitivas serem certificados no ambiente alvo.
- Merge: **NÃO EXECUTADO E NÃO AUTORIZADO NESTA RODADA**.

**Status:** `HARMONY_CANONICAL_RECONCILED_LOCAL`.
