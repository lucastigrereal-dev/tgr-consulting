# TGR Consulting — Runbook

## Pré-requisitos

Node/pnpm compatíveis com `package.json`, Docker, MySQL 8 efêmero e Microsoft Edge/Chrome/Chromium. Não use `.env` ou credenciais de produção para certificação local.

## Gates locais

```powershell
pnpm install --frozen-lockfile
pnpm run check
pnpm run test:migration:legacy
pnpm run test:integration:db
pnpm run test:backup-restore
pnpm run test:e2e:master
pnpm run build
pnpm audit --audit-level=low
git diff --check
```

Para a contagem completa de `pnpm test`, mantenha temporariamente o MySQL do harness de integração ativo e defina `DATABASE_URL` para `tgr_consulting_test`; depois derrube o compose. Nunca aponte esses scripts a outro schema.

## E2E master

`pnpm run test:e2e:master` sobe MySQL, migrations, servidor, storage local de teste e browser headless; cria sessão temporária, percorre a jornada master híbrida, valida bytes PDF/PPTX/XLSX e exige evidência para 30/30 casos adversariais. O `finally` remove servidor e compose.

## Restore

`pnpm run test:backup-restore` valida projeto/serviço/container/porta/schema antes do drop, gera dump fora do repositório, calcula SHA-256, restaura, verifica canary e limpa os resíduos.

## Produção

Forneça configuração apenas por secret manager. Execute migrations com backup e rollback aprovados, teste OAuth/storage reais, ligue observabilidade e faça smoke pós-deploy. Merge, deploy, migração compartilhada, pagamentos e operações irreversíveis exigem gate humano explícito.

Detalhes complementares permanecem em `TGR_OPERATIONAL_RUNBOOK.md` e o resultado de cada source certificado fica em `TGR_VERIFICATION_RECEIPT.md`.
