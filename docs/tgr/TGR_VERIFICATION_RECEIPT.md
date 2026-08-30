# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-08-30
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `89ad2e4f43fd3a61c462e75e3f51f11958448fd4`
- Ambiente: Windows local, MySQL 8.4 efêmero e Microsoft Edge headless
- Credenciais de produção: não usadas

Este arquivo é o commit de receipt posterior ao source head acima; o SHA final do branch fica registrado no PR.

## Gates executados

| Comando/prova | Resultado |
| --- | --- |
| `pnpm run check` | PASS — TypeScript sem emissão |
| `pnpm run build` | PASS — 1.798 módulos Vite + bundle Node |
| `pnpm run test:integration:db` | PASS — 3 arquivos, 11 testes, migrations `0000`–`0013` |
| `pnpm test` com MySQL efêmero ativo | PASS — 45 arquivos, 160 testes |
| `pnpm run test:smoke:auth` | PASS — 7 rotas + 11 capítulos em 4 viewports |
| `pnpm run test:backup-restore` | PASS — dump, hash, recreate, restore, canary e limpeza |
| `pnpm audit --prod` | PASS — zero vulnerabilidades conhecidas |
| `git diff --check` | PASS |

Os arquivos de teste são executados sem paralelismo entre files porque as integrações compartilham deliberadamente um único schema efêmero. O bootstrap do formula set também usa upsert transacional para tolerar criação concorrente em runtime.

## Restore drill

- Banco validado: `tgr_consulting_test`
- Tamanho do dump: 31.181 bytes
- SHA-256: `02e94643b158caf003189503989df5a4166f8ba8fe46420765b6a2d5877bccc8`
- Canary: validado
- Container e network: removidos ao final

O hash muda quando timestamps ou dados efêmeros mudam; sua função aqui é provar integridade entre dump e restore da execução registrada.

## Smoke autenticado

- desktop: 1280×720;
- apresentação: 1920×1080;
- zoom 200% equivalente: 960×540;
- mobile: 375×812;
- verificações: sessão aceita, conteúdo principal não vazio, ausência de overflow global, foco por teclado, navegação dos 11 capítulos e zero `console.error`.

Foram geradas e inspecionadas capturas locais do Boardroom em desktop, apresentação e zoom 200%. A sessão, o usuário, o banco e as capturas eram efêmeros e não contêm credenciais de produção.

## Limite da certificação

Esta é uma certificação local do código. OAuth real, object storage real, deploy/observabilidade e restore segundo RPO/RTO do banco gerenciado continuam gates externos documentados em `TGR_SECURITY_CHECKLIST.md` e `TGR_KNOWN_ISSUES.md`.
