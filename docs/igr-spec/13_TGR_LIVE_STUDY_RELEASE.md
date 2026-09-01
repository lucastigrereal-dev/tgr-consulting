# TGR — Estudo de Viabilidade Financeira Vivo

## Produto reorientado

O **TGR** deixa de se apresentar como painel financeiro genérico e passa a operar como um estudo de viabilidade vivo. A pessoa começa por premissas e decisões documentadas; o sistema persiste a versão de trabalho, recalcula o snapshot, atualiza demonstrativos e indicadores, mostra o impacto, sustenta a conclusão e controla a exportação pela mesma fonte autoritativa.

| Capítulo canônico  | Conteúdo do estudo                                          | Entrada principal                      | Saída visível                                |
| ------------------ | ----------------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| Produto e preço    | Estoque, frações, ticket, condição e pagamento              | Premissas e bloco detalhado            | Receita potencial e base comercial           |
| Comercial          | Captação, funil, conversão, parceiros e comissão            | Premissas e bloco operacional          | Volume, conversão e receita                  |
| Operação e pessoas | Sala, recepção, consultores, closers, custos e workforce    | Bloco operacional e catálogo de custos | Capacidade, custo e gargalos                 |
| Financeiro         | Receita, carteira, perdas, caixa, CAPEX, OPEX e indicadores | Core determinístico                    | Fluxo de caixa, VPL, TIR e payback           |
| Decisão e memória  | Cenários, riscos, aprovação, baseline e histórico           | Snapshot e governança                  | Conclusão, comparativo e artefato autorizado |

## Cadeia de atualização

> **Premissa ou decisão → hash de input → cálculo decimal → snapshot → delta de KPI → capítulos impactados → alerta/conclusão → aprovação → exportação.**

O Boardroom consulta o histórico de snapshots do projeto. Ao existir versão anterior, compara VPL, TIR, Payback e caixa. A última atualização de premissas também registra no audit trail quais inputs mudaram; o TGR converte essa causa em capítulos e demonstrativos afetados. Se faltarem premissas obrigatórias, o snapshot fica bloqueado, a conclusão aponta a pendência e a exportação permanece indisponível. A aprovação e o congelamento de baseline liberam a entrega com hash da versão autoritativa.

## Validação desta versão

| Controle              | Evidência                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cálculo e contratos   | 40 testes automatizados aprovados.                                                                                                                             |
| Fluxo com banco e API | Teste tRPC cria projeto, altera premissa, registra decisão/custo, calcula snapshot, verifica impacto, bloqueia exportação e só libera após aprovação/baseline. |
| Navegação             | Smoke autenticado verificou seis telas e cinco capítulos canônicos em desktop e mobile.                                                                        |
| Build                 | Build de produção concluído.                                                                                                                                   |
| Dependências          | Auditoria de produção sem vulnerabilidades conhecidas.                                                                                                         |

## Limite deliberado da formulação atual

Os blocos detalhados de produto, comercial, operação e pessoas já são capturados com fonte, pendência e proveniência. O **core autoritativo atual** calcula as premissas financeiras publicadas no formula set vigente. Cada nova regra matemática do PDF só deve passar a alimentar o snapshot depois de ser definida, versionada e testada; o TGR preserva o restante como `PENDENTE` em vez de inventar número para encher demonstrativo.
