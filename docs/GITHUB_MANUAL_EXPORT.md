# Exportação manual do TGR Consulting para o GitHub

O checkpoint do TGR está salvo no Manus. Como a integração GitHub está desativada nesta sessão, o caminho alternativo é exportar o código e publicar pelo GitHub web ou pelo Git local no Windows.

## Opção A — GitHub web

Crie um repositório vazio no GitHub, sem README, licença ou `.gitignore` automático. Baixe o arquivo `tgr-consulting-export.zip`, extraia o conteúdo e, na página do repositório, use **Add file → Upload files**. Arraste os arquivos extraídos, escreva uma mensagem como `Importa checkpoint TGR Consulting`, revise a lista e confirme o commit.

Não envie arquivos `.env`, credenciais, `node_modules`, `dist`, logs ou diretórios temporários. O pacote exportado é preparado sem esses itens. Depois do upload, confirme que `package.json`, `client`, `server`, `shared`, `drizzle`, `docs` e `scripts` aparecem no repositório.

## Opção B — Git local no Windows

No PowerShell, depois de extrair o ZIP, execute:

```powershell
cd C:\caminho\tgr-consulting
 git init
 git branch -M main
 git add .
 git status
 git commit -m "Importa checkpoint TGR Consulting"
 git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
 git push -u origin main
```

Antes do `git add`, confirme que não há `.env` nem credenciais no diretório. Se o repositório remoto já tiver commits, não use `--force` de primeira: faça `git pull --rebase origin main`, resolva conflitos e só então envie.

## Estado da sincronização auditado

O projeto local está na branch `main`, com `origin/main` apontando para o remoto interno do ambiente Manus. O último checkpoint local confirmado é `a3d79bd6` no Management UI; ele não equivale a um repositório público do GitHub. O pacote exportável deve ser tratado como a fonte para o primeiro commit no GitHub, sem publicar automaticamente.

## Validação após publicar

No repositório publicado, confirme a presença do código e rode localmente `pnpm install`, `pnpm check`, `pnpm test` e `pnpm build`. O projeto deve manter o ciclo da Página 1 Cotia, o Estudo Vivo em `/study`, a simulação multialavanca e o motor financeiro determinístico.
