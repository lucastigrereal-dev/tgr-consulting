# HARMONY_COMPAT_V1 — evidência E2E local

Gerado por `pnpm run test:e2e:master` em 2026-09-01, usando MySQL 8.4 efêmero e Microsoft Edge headless.

## Identidade da execução

- modo: `HARMONY_COMPAT_V1`
- Formula Set: `1.0.0`
- engine: `harmony-compat-engine-v1`
- autoridade: `SOURCE_CONFLICT`
- fonte ausente: `COTAS_NATAL_ESTUDO_VIABILIDADE_HARMONY_MASTER_V1`
- paridade com o workbook alegada: `false`
- criação do projeto: Página 1 Cotia real via UI, seguida do mesmo `projectId/versionId` no cálculo, cenário, aprovação e export
- baseline: `100.00000000` vendas brutas no mês 1
- cenário aprovado: `120.00000000` vendas brutas no mês 1
- snapshot baseline: `2fa8a906cae9d43250f9861c44a6234615d2358d5d0c2ae3b08dfa9dc01803cb`
- snapshot cenário aprovado: `cdff5550a144d036ad5df81fc6427dd3bc96f45636ac057f6f5da496d00a9fa7`
- export pack: `51fb85c0a3e32f0142c12a1ab4b6940fed9a8d654ff6e99ec866554dd9c54da1`

Os três formatos de exportação foram gerados do snapshot aprovado e exibem modo, label, Formula Set, engine, hash do snapshot, `SOURCE_CONFLICT`, a fonte ausente e a ressalva de que a paridade não está certificada. O E2E validou a proveniência visível dentro dos arquivos, não apenas em metadata de banco. A variação 100 → 120 foi verificada em estoque, entrada, parcelas/recebíveis, DRE, comissão, caixa e KPIs.

## Arquivos e SHA-256

| Arquivo | SHA-256 |
| --- | --- |
| `01c-harmony-natal-builder-desktop.png` | `41126c38601ef22ba9416b477358a11dead5b1b96aa174bcbc02b18a31d11d68` |
| `01d-harmony-natal-builder-mobile.png` | `9260506562e1c4005973c7481bcb84eb352640a39c1cca875b134379ad0de4c0` |
| `03-harmony-natal-boardroom-desktop.png` | `bb52de4a79ef056a4f618d0338d175acfa89b0e6e45a8d9091413ac5b66a9ee0` |
| `04-harmony-natal-boardroom-mobile.png` | `3951a5f2ee33b74185d2e51f6a3588c5d5a4911a36f1a3aaae659bc5e127c257` |
| `05-harmony-natal-approved-baseline-desktop.png` | `3b5d7592886514f6233e5c701e67760cd8a99d2fc958c693084de2c2f763a212` |
| `06-harmony-natal-approved-baseline-mobile.png` | `5973f559479abf49ca08350b93aa9a79acadd87e819f146e15f8b1f4ed481680` |
| `natal-harmony-compat-v1.pdf` | `f4047d51fe90915875b8bf74e875ada7f2f0c36b86f9b70f2a7dc04ebc8b94b3` |
| `natal-harmony-compat-v1.pptx` | `fe9447c4dafd4751c22e5d428c66e6e5ea83daef59ef66194fa04ffd193e1eab` |
| `natal-harmony-compat-v1.xlsx` | `d216fa017bdf490ec98604fc920bc162bbb6e81a4129b496cf6059d6a1b70278` |

## Limite de autoridade

Esta evidência certifica o comportamento implementado contra as regras disponíveis no review do PR #1. Como o workbook completo não estava disponível no workspace, cinco conflitos documentais permanecem `SOURCE_CONFLICT`; diferenças esperadas entre o motor Harmony e o TGR canônico são classificadas separadamente como `MODEL_DELTA`. Os números não foram calibrados silenciosamente para coincidir com os alvos aproximados do review.
