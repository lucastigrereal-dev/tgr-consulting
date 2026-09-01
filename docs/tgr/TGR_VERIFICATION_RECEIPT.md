# TGR Consulting — Verification Receipt

## Identidade

- Data local: 2026-08-31
- Repositório: `lucastigrereal-dev/tgr-consulting`
- Branch: `codex/tgr-master-brd-v1`
- Source head certificado: `085b4516e4ab64747d0678cd9077a0d769078be9`
- Base remota desta rodada: `25681761263586ab8e0e298c5fe1bc3b38650a4b`
- Ambiente: Windows local, MySQL 8.4 efêmero e Microsoft Edge headless
- Credenciais/serviços de produção: não usados
- Merge: não executado

Este receipt é posterior ao source head certificado. O commit exclusivamente documental e o estado remoto final são registrados no PR.

## Resumo da rodada

O branch agora executa o Golden Natal em 120 meses sobre a engine canônica, materializa a Página 1 Cotia como matriz viva, simula `100 → 120` vendas/mês no controle visual do Boardroom sem alterar a baseline, promove a hipótese a cenário auditável e exporta PDF/PPTX/XLSX somente de snapshot aprovado e congelado. O pack de exportação mantém a mesma identidade determinística entre formatos e transporta snapshot, versão, autor, data e lifecycle.

Também foram fechados os P1 encontrados na revisão final: proteção contra perda do draft Cotia, semântica decimal consistente para percentuais na UI, capítulo ativo sincronizado durante scroll manual, reload autenticado robusto e separação reproduzível entre testes unitários e integração MySQL.

## Gates executados no source head

| Comando/prova | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — lockfile atual, nenhuma alteração |
| `pnpm run check` | PASS — TypeScript sem emissão |
| `pnpm test` | PASS — 49 arquivos, 217 testes unitários/UI |
| `pnpm run test:integration:db` | PASS — migrations + 3 arquivos, 17/17 testes MySQL |
| `pnpm run build` | PASS — Vite 7.3.5, 1.878 módulos + bundle Node |
| `pnpm audit --prod --audit-level=high` | PASS — nenhuma vulnerabilidade conhecida |
| `pnpm run test:e2e:master` | PASS — jornada híbrida autenticada, 30/30 casos adversariais, 4 viewports × 16 capítulos |
| testes focados Golden/export/Payment Calendar | PASS — 17/17 |
| testes focados Builder/Boardroom/Golden/export | PASS — 35/35 |
| `git diff --check` | PASS |
| revisões independentes P0/P1 | PASS após correções — nenhum P0/P1 conhecido no delta final |

## Golden Natal

Fixture: `golden/natal-ponta-negra-2026`, Fórmula Set `1.9.0`, engine `igr-engine-1.9.0`, vetor esperado SHA-256 `ee202772ccc4234f0fb9e790b3834373fd747a9cd83e9d19ddd010eff435cfe1`.

| Indicador | Esperado | Obtido | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| Vendas líquidas/contratos ativos | 3.120,00000000 | 3.120,00000000 | 0 | PASS |
| Sell-out | mês 43 | mês 43 | 0 | PASS |
| Receita reconhecida | R$ 76.258.836,34 | R$ 76.258.836,34 | 0 | PASS |
| Caixa operacional | R$ 33.922.836,35 | R$ 33.922.836,35 | 0 | PASS |
| Capital necessário | R$ 2.885.282,30 | R$ 2.885.282,30 | 0 | PASS |
| VPL | R$ 17.556.378,03 | R$ 17.556.378,03 | 0 | PASS |
| Payback | 33,26222707 meses | 33,26222707 meses | 0 | PASS |
| TIR | não aplicável ao fluxo do fixture | `null` | — | PASS |

Premissas comerciais/contratuais ainda não aprovadas estão explicitamente marcadas `TEST DATA` ou `PENDING`; o sistema não inventa INCC/IGP-M nem política final de comissão.

## Identidade E2E e exports

- snapshot oficial Golden: `b8c3cc711cd6d3589fe1a0ef7c4a9363c3ed4502aee52e848f62aa69e3a7cb2b`;
- snapshot aprovado do cenário Golden: `bb677df7bb57997947b03779e53e8bc5c4d9ddeb494ddae255cfbb9e2c6c147b`;
- baseline visual: `100.00000000` vendas/mês;
- hipótese visual: `120.00000000` vendas/mês;
- export pack Golden: identidade única validada como igual entre PDF/PPTX/XLSX na execução final;
- export genérico: PDF 8.737 bytes, PPTX 18.296 bytes, XLSX 23.025 bytes;
- Boardroom responsivo: desktop, apresentação, zoom 200% equivalente e mobile; 16 capítulos por viewport;
- evidência visual local: `C:\Users\lucas\AppData\Local\Temp\tgr-e2e-master-I2qXSK\screenshots` (Builder desktop/mobile e Boardroom desktop/mobile).

O E2E é explicitamente híbrido: browser real cobre sessão, seleção de projeto, navegação, edição da meta `100 → 120`, delta visível, screenshots, logout/reentrada e reload; tRPC autenticado prepara domínios densos e executa promoção/aprovação/exportação. Não há alegação de jornada integral apenas por cliques.

## QA visual

| Tela | Desktop | Mobile | Status | Observação |
| --- | --- | --- | --- | --- |
| Builder / Página 1 Cotia | Inspecionada | consulta funcional | PASS | matriz viva, campos editáveis/derivados e `PENDING`; draft não salvo sinalizado |
| Boardroom Golden Natal | Inspecionada | 375×812 inspecionado | PASS | identidade TGR, sem overflow global, foco por teclado e navegação sincronizada ao scroll |
| Cenários/exportação | Exercitada no E2E | consulta funcional | PASS | baseline não muda antes da ação explícita; export requer aprovação + freeze |

## Commits da rodada

Foram produzidos 18 commits de implementação/teste entre `4d902ac0459b5de16455b2d686792b42296786bd` e `085b4516e4ab64747d0678cd9077a0d769078be9`, cobrindo Golden Natal, Fórmula Set 1.9, Cotia transacional, Boardroom, scenario promotion, export provenance, QA e gates reproduzíveis. O histórico completo é a fonte canônica da lista de arquivos alterados.

## Limite da certificação e GO/NO-GO

- Demo interna: **GO**.
- Demonstração de produto a investidor: **GO CONDICIONAL**, deixando visível que comissões, curva contratual INCC/IGP-M, recuperação e custos agregados do Golden são `TEST DATA/PENDING`, não orçamento aprovado.
- Uso do Golden como previsão econômica contratual do Natal: **NO-GO** até aprovação comercial/financeira das políticas pendentes.
- Produção: **NO-GO** até OAuth/storage/deploy/observabilidade/secrets/rate limiting/backup gerenciado e políticas financeiras definitivas serem certificados no ambiente alvo.

Gaps restantes são externos ou deliberadamente P2: detalhamento adicional de Cost Catalog/CAPEX por driver e rubrica, validação inline mais granular nos formulários densos, affordance de scroll horizontal mobile e texto explicativo para TIR não aplicável. Nenhum deles invalida a demo interna nem a reação E2E do estudo.

**Status da missão:** `RELEASE_CANDIDATE_LOCAL` — core Golden Natal e jornada de investidor comprovados; merge não executado.
