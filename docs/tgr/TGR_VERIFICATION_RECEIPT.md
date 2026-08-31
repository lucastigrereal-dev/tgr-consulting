# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-08-30
- Repositório: `lucastigrereal-dev/tgr-consulting`
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `891a8411a187b74d2aa09d5be3a1895df3b4f0a3`
- Ambiente: Windows local, MySQL 8.4 efêmero e Microsoft Edge headless
- Credenciais de produção: não usadas

Este receipt é posterior ao source head certificado. O SHA do commit documental e o estado remoto ficam registrados no PR.

## Gates executados

| Comando/prova | Resultado |
| --- | --- |
| `pnpm run check` | PASS — TypeScript sem emissão |
| `pnpm run build` | PASS — Vite 7.3.5, 1.877 módulos + bundle Node |
| `pnpm run test:migration:legacy` | PASS — deduplicação 0011, backfill cronológico/as-of 0014 e revisão financeira 0015 |
| `pnpm run test:integration:db` | PASS — 3 arquivos, 14 testes, migrations `0000`–`0015` |
| `pnpm test` com MySQL efêmero ativo | PASS — 48 arquivos, 193 testes |
| `pnpm run test:e2e:master` | PASS — jornada híbrida autenticada, 30/30 casos adversariais, 4 viewports × 16 capítulos |
| `pnpm run test:backup-restore` | PASS — dump, hash, restore, canary e limpeza |
| `pnpm audit --audit-level=low` | PASS — nenhuma vulnerabilidade conhecida |
| busca de instrumentação em `dist` | PASS — plugins de desenvolvimento ausentes do bundle de produção |
| `git diff --check` | PASS |
| revisão final P0/P1 | PASS — nenhum bloqueador restante no diff certificado |

## Identidade E2E e exports

- snapshot oficial: `8d99b6ec20ea4229d0c2a849c6075d2102b114e8cfc62676dc99600a9242d874`;
- snapshot comparável do cenário: `6e804ccdc060ccca8510d7121818c4388587c4b00a299425eac0da7b28126850`;
- snapshot deliberadamente incompatível e excluído: `9d444544f8612a0b448ead9785a92fe967e1fade3a601983db7850f91d7ad1c7`;
- export pack: `99b3dc842a6db5a8edd40b3238c897af1f92fa94e4ab5470a0d78f60058ae9e9`;
- PDF: 8.097 bytes; PPTX: 17.691 bytes; XLSX: 19.941 bytes;
- Boardroom responsivo: 4 viewports, 16 capítulos por viewport.

O E2E é explicitamente híbrido: browser real cobre sessão, navegação, Boardroom, logout/reentrada e reload; tRPC autenticado prepara domínios cuja edição click-only completa ainda não existe. Não há alegação de jornada integral apenas por cliques.

## Restore drill

- banco validado: `tgr_consulting_test`;
- tamanho do dump: 31.581 bytes;
- SHA-256: `951f033a130b260e5aac96afe15c968bd7a85650dfe5139d5ad09bcbb790e7b3`;
- canary: validado;
- container e network: removidos ao final.

O hash muda com os dados efêmeros; ele prova integridade entre dump e restore desta execução.

## Limite da certificação

Este é um release candidate local do código, não uma declaração de produção ativa. OAuth real, object storage real, deploy/observabilidade, secret manager, rate limit distribuído e restore segundo RPO/RTO do banco gerenciado continuam gates externos. Merge não foi executado.
