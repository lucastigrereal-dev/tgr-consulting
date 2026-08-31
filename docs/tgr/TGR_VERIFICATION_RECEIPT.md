# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-08-30
- Repositório: `lucastigrereal-dev/tgr-consulting`
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `d6c3f3c125c2fb8b8e0451274c25e85cf2c9d908`
- Ambiente: Windows local, MySQL 8.4 efêmero e Microsoft Edge headless
- Credenciais de produção: não usadas

Este receipt é posterior ao source head certificado. O SHA do commit documental e o estado remoto ficam registrados no PR.

## Gates executados

| Comando/prova | Resultado |
| --- | --- |
| `pnpm run check` | PASS — TypeScript sem emissão |
| `pnpm run build` | PASS — Vite 7.3.5, 1.877 módulos + bundle Node |
| `scripts/test-legacy-component-migration.ps1 -Port 13332` | PASS — deduplicação 0011, backfill cronológico/as-of 0014, revisão financeira 0015 e tratamento legado seguro 0016 |
| `pnpm run test:integration:db` | PASS — 3 arquivos, 14 testes, migrations `0000`–`0016`, rollback sob drift concorrente e ordem total do catálogo |
| `pnpm test` com MySQL efêmero ativo | PASS — 48 arquivos, 195 testes |
| `pnpm run test:e2e:master` | PASS — jornada híbrida autenticada, 30/30 casos adversariais, 4 viewports × 16 capítulos |
| `pnpm run test:backup-restore` | PASS — dump, hash, restore, canary e limpeza |
| `pnpm audit --prod` | PASS — nenhuma vulnerabilidade conhecida |
| busca de instrumentação em `dist` | PASS — plugins de desenvolvimento ausentes do bundle de produção |
| `git diff --check` | PASS |
| revisão final P0/P1 | PASS — nenhum bloqueador restante no diff certificado |
| orçamento de performance | PASS local — cálculo adversarial de 120 meses abaixo de 2 s; bundle principal 417,48 kB (129,80 kB gzip) |

## Identidade E2E e exports

- snapshot oficial: `a699579aac51366d016bcb3a28620841b7f1e1804c1b2fa97ee073878e0b55cc`;
- snapshot comparável do cenário: `b5794ececee3fcc1bca0912b6ea9b299daee2ca246225a9e77fb874b84c2e296`;
- snapshot deliberadamente incompatível e excluído: `dc14d9c9e6554439dcc49d30be7029136f2fa3708bfaa183b7fb6c45441ca1ba`;
- export pack: `5631b01c6d1c085e7812efb6ef6216a78419bc6cbcb22feebd5ef71788f2f3c2`;
- PDF: 8.124 bytes; PPTX: 17.690 bytes; XLSX: 19.976 bytes;
- Boardroom responsivo: 4 viewports, 16 capítulos por viewport.

O E2E é explicitamente híbrido: browser real cobre sessão, navegação, Boardroom, logout/reentrada e reload; tRPC autenticado prepara domínios cuja edição click-only completa ainda não existe. Não há alegação de jornada integral apenas por cliques.

## Restore drill

- banco validado: `tgr_consulting_test`;
- tamanho do dump: 31.785 bytes;
- SHA-256: `fe4f80f2bcfbb30b6d1d344dcaf6b6c11ea75c5ea1889ed2d58f60dc6d15343d`;
- canary: validado;
- container e network: removidos ao final.

O hash muda com os dados efêmeros; ele prova integridade entre dump e restore desta execução.

## Limite da certificação

**Status da missão:** `PARTIAL` — P0 local = 0 e o branch é um release candidate local; produção permanece gated.

Este é um release candidate local do código, não uma declaração de produção ativa. OAuth real, object storage real, deploy/observabilidade, secret manager, rate limit distribuído e restore segundo RPO/RTO do banco gerenciado continuam gates externos. Contratos de negócio ainda `PENDING` estão enumerados em `TGR_KNOWN_ISSUES.md`. Merge não foi executado.
