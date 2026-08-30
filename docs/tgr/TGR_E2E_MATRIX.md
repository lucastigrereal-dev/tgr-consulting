# TGR Consulting — Matriz E2E

| Jornada | Prova automatizada | Estado |
| --- | --- | --- |
| Criar projeto/versionar premissas | integração MySQL | PASS local |
| Salvar produto + condições como unidade | integração MySQL com falha forçada e rollback | PASS local |
| Persistir pontos e operação comercial | integração MySQL + testes de domínio | PASS local |
| Calcular snapshot determinístico | testes do engine/snapshot/regressão | PASS local |
| Calcular carteira e Healthy D90 | testes de coortes/recebíveis/engine | PASS local |
| Criar cenário e aplicar Goal Seek | integração MySQL + testes de convergência/inviabilidade | PASS local |
| Submeter, aprovar e congelar baseline | integração MySQL sequencial e concorrente | PASS local |
| Gerar PDF/PPTX/XLSX de snapshot aprovado | testes de artefato e integração | PASS local |
| Navegar UI autenticada | 7 rotas, 11 capítulos, teclado e ausência de overflow em 4 viewports | PASS local |
| Restaurar backup | dump/hash/drop/recreate/restore/canary em banco efêmero nomeado | PASS local |
| OAuth, storage e deploy reais | exige infraestrutura/credenciais externas | GATE EXTERNO |

## Viewports do smoke autenticado

- desktop: 1280×720;
- apresentação: 1920×1080;
- zoom 200% equivalente: 960×540;
- mobile: 375×812.

O smoke usa sessão local temporária e banco efêmero; não simula sucesso de OAuth ou storage de produção.
