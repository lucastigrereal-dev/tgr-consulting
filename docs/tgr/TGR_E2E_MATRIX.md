# TGR Consulting — Matriz E2E

| Jornada | Prova automatizada | Estado |
| --- | --- | --- |
| Criar projeto/versionar premissas | integração MySQL | PASS local |
| Salvar produto + condições como unidade | integração MySQL com falha forçada e rollback | PASS local |
| Persistir pontos, carteira e operação comercial | integração MySQL + testes de domínio | PASS local |
| Calcular snapshot determinístico | engine/snapshot/regressão + E2E master | PASS local |
| Calcular carteira e Healthy D90 | testes de coortes/recebíveis/engine | PASS local |
| Criar cenário e aplicar Goal Seek V1 | integração MySQL, payload forjado, branch divergente e corrida de revisão | PASS local |
| Comparar cenários compatíveis | mesmo horizonte/as-of; cenário incompatível deliberadamente excluído | PASS local |
| Submeter, aprovar e congelar baseline | integração MySQL sequencial e concorrente | PASS local |
| Gerar PDF/PPTX/XLSX de snapshot aprovado | testes de artefato + E2E master com bytes e hashes | PASS local |
| Navegar UI autenticada | browser real, 16 capítulos, teclado e overflow em 4 viewports | PASS local |
| Casos adversariais | 30/30 com evidência de domínio, API ou browser | PASS local |
| Restaurar backup | dump/hash/restore/canary em banco efêmero nomeado | PASS local |
| OAuth, storage e deploy reais | exige infraestrutura/credenciais externas | GATE EXTERNO |

## Viewports do E2E autenticado

- desktop: 1280×720;
- apresentação: 1920×1080;
- zoom 200% equivalente: 960×540;
- mobile: 375×812.

## Limite da jornada

O E2E master é híbrido. O browser cobre autenticação local, rotas, checkpoints, Boardroom, logout/reentrada e reload. O setup de domínios complexos usa tRPC autenticado onde a UI ainda não oferece editor click-only completo. A prova não simula sucesso de OAuth, Forge/object storage ou deploy de produção.
