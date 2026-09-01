# HARMONY_COMPAT_V1 — evidência E2E canônica

Gerado por `pnpm run test:e2e:master` em 2026-09-01, usando MySQL 8.4 efêmero e Microsoft Edge headless.

## Identidade da execução

- modo: `HARMONY_COMPAT_V1`
- horizonte: 144 meses
- Formula Set: `1.0.0`
- engine: `harmony-compat-engine-v1`
- autoridade: `CANONICAL_FROM_HARMONY_MASTER_V1`
- fonte canônica: `docs/tgr/golden/COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json`
- paridade dos valores publicados: certificada para os três cenários
- conflito preservado: `SC-001`, cronograma com 4.457 vendas brutas versus indicador publicado de 4.458
- criação do projeto: Página 1 Cotia via UI, seguida do mesmo `projectId/versionId` no cálculo, cenário, aprovação e export
- baseline: `100.00000000` vendas brutas no mês 1
- cenário aprovado: `120.00000000` vendas brutas no mês 1
- snapshot baseline: `6ff9e9a081edcfc71843fdd64e31526d11b721bbe3fe5964aa93b09813bc30c5`
- snapshot cenário aprovado: `43318f57675ae82fa0d6005a27e08ed2671a4458e3c5677f6d15dac078cbe3bd`
- export pack: `a71543b57e2f339eea210b6559246b5df2bb9efd2f841bcd73dfef495b71edef`

Os três formatos de exportação foram gerados do snapshot aprovado e exibem modo, Formula Set, engine, hash do snapshot, autoridade canônica, fonte e `SC-001`. O E2E validou a provenance dentro dos arquivos. A variação 100 → 120 foi verificada em estoque, entrada, parcelas/recebíveis, DRE, comissão, caixa e KPIs, sem mutação do baseline.

## Arquivos e SHA-256

| Arquivo | SHA-256 |
| --- | --- |
| `01c-harmony-natal-builder-desktop.png` | `48d1ff3caa1edf9adf8b92c531076720ad5cef936fe4c233d514f0e23081704c` |
| `01d-harmony-natal-builder-mobile.png` | `949fafad7d489d4b02ef7a2a1a065b78365ca7ac36f024d885e6e34c2fbae1fe` |
| `03-harmony-natal-boardroom-desktop.png` | `7b8ff34b448d8c5eee0687e693f6250ede0f8d2b2f69b6aef7ab047873034abd` |
| `04-harmony-natal-boardroom-mobile.png` | `a6ea5cd38754a81aa9ea865a760f9629761ee472b93c83846c31d87046800691` |
| `05-harmony-natal-approved-baseline-desktop.png` | `e3e69741e173c23ea740eb145559cb76770d3fa5c9b3aad774ad9e5b2f202f11` |
| `06-harmony-natal-approved-baseline-mobile.png` | `8609c260e1e70971231d19f5f218fe6ebf1e652787b2ca80c3320cb660051661` |
| `natal-harmony-compat-v1.pdf` | `8b2389552f4fafcc901d29286cf19341aedefe7401d9a7edffad9e1cab4c0632` |
| `natal-harmony-compat-v1.pptx` | `6bfa20e5be1eafa258ae9a19b997d5acbb556ba4cc6bf675c3e13a7f620a6082` |
| `natal-harmony-compat-v1.xlsx` | `f25ad0047c655d3a1cf29a693aa25a62eeb11d8471ec08481e1e317b878b0f4b` |

## Limite de autoridade

A certificação cobre as regras e valores publicados na fonte canônica disponível. `SC-001` não foi arbitrariamente normalizado: o motor adota o cronograma de 4.457 vendas brutas para os fluxos e mantém 4.458 como conflito de indicador rastreável. Diferenças semânticas entre `HARMONY_COMPAT_V1` e `TGR_CANONICAL_V1` permanecem classificadas como `MODEL_DELTA`, não como erro de reconciliação Harmony.
