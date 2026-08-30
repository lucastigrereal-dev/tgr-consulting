# TGR Consulting — Runbook operacional local

## Pré-requisitos

- Node e pnpm compatíveis com `package.json`/lockfile;
- Docker disponível para provas MySQL;
- navegador Chromium/Edge para smoke visual;
- nenhuma credencial de produção é necessária para certificação local.

## Certificação

```powershell
pnpm install --frozen-lockfile
pnpm run check
pnpm run test:integration:db
pnpm run test:backup-restore
pnpm test
pnpm run build
```

`pnpm test` inclui testes que precisam de `DATABASE_URL`; para a prova completa, execute-o com o MySQL efêmero do harness de integração ativo. O script `test:integration:db` sobe, migra, testa e remove seu próprio ambiente.

## Smoke autenticado

1. suba um MySQL efêmero e aplique migrations;
2. crie apenas um usuário local de smoke;
3. inicie `dist/index.js` com `NODE_ENV=smoke`, URL local e segredo temporário;
4. defina `SMOKE_BASE_URL`, `OWNER_OPEN_ID`, `CHROMIUM_PATH` e, opcionalmente, `SMOKE_SCREENSHOT_DIR`;
5. execute `pnpm run test:smoke:auth`;
6. pare servidor e remova containers/networks do projeto de smoke.

Não reutilize esse modo como deploy de produção.

## Restore drill

`pnpm run test:backup-restore` só opera sobre o banco efêmero explicitamente validado como `tgr_consulting_test`. O script gera dump temporário, calcula SHA-256, recria, restaura, verifica canary e limpa os resíduos.

## Produção

O processo deve receber por secret manager: `DATABASE_URL`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, `JWT_SECRET`, `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY`. Nunca grave esses valores no repositório. Depois do deploy, execute os gates externos de `TGR_SECURITY_CHECKLIST.md`.
