# Plano de Waves e Gates — IGR Consulting

## Princípio de execução

Cada wave entrega uma superfície usável e testada. Não existe “quase pronto” em motor financeiro: número sem proveniência, teste ou versão continua sendo rascunho com perfume.

| Wave          | Escopo                                                                                             | Dependências                              | Gate de saída                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0 — Fundação  | Study Report, Discovery, ADR, PRD, Blueprint, fontes e matriz QA.                                  | Inventário do pacote e pesquisa técnica.  | Decisões de arquitetura documentadas; pendências preservadas.                                   |
| 1 — Core      | Contratos, decimal engine, projeções 1–120, fórmulas base, snapshots e memória.                    | Formula registry e dataset real/pendente. | Invariantes passam; execução repetida mantém hash; sem `number` no core.                        |
| 2 — Builder   | Produto, estoque, preço, CAPEX/OPEX, custos, workforce, captação, capacidade, comissão e carteira. | Core da Wave 1.                           | Inputs pendentes ficam explícitos e recalculam KPIs dependentes.                                |
| 3 — Decisão   | Cenários, branches, baseline, Goal Seek, Capital Envelope e approval.                              | Versões, snapshots e fórmulas.            | Baseline imutável; Goal Seek evidencia bounds e erro residual.                                  |
| 4 — Boardroom | Visão Private Banking, comparação, KPI memory, drill-down e lineage visual.                        | Snapshots e cenário.                      | Todo valor apresentado abre origem e é igual ao snapshot autoritativo.                          |
| 5 — Artefatos | PDF/PPTX, histórico opcional e retenção de exportações.                                            | Snapshot validado/aprovado e storage.     | Tentativa de exportar snapshot inválido falha; artefato aponta para hash e versão.              |
| 6 — RC        | Regressão Pipa, seed Natal honesta, segurança, performance e auditoria adversarial.                | Waves anteriores.                         | Suite verde, vulnerabilidades reproduzíveis corrigidas, changelog e guia operacionais fechados. |

## Critérios cumulativos

| Critério                                | Wave a partir da qual é obrigatório |
| --------------------------------------- | ----------------------------------- |
| Contratos tipados e validação de inputs | 1                                   |
| Aritmética decimal                      | 1                                   |
| Teste de fórmula e invariantes          | 1                                   |
| Proveniência e hash de snapshot         | 1                                   |
| Preservação de `PENDENTE`               | 2                                   |
| Controle de baseline e branches         | 3                                   |
| Comparação e memória em boardroom       | 4                                   |
| Bloqueio de exportação por autoridade   | 5                                   |
| Regressão Pipa e auditoria adversarial  | 6                                   |
