# PRD V1 — IGR Consulting

## Problema

Planejamento de multipropriedade costuma nascer espalhado em planilhas, apresentações, memória de operador e números difíceis de reproduzir. O IGR concentra a modelagem e dá ao decisor um caminho auditável para ir de premissas a aprovação e exportação.

## Perfis e permissões

| Perfil                | Pode fazer                                                                         | Não pode fazer                            |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Administrador técnico | Gerir formula sets, aprovar versões e desbloquear governança.                      | Alterar histórico sem registro.           |
| Planejador            | Criar projetos, preencher inputs permitidos, criar cenários e solicitar aprovação. | Mudar fórmula protegida ou baseline.      |
| Comitê                | Consultar Boardroom, memória e comparação; aprovar/reprovar conforme permissão.    | Editar premissas de forma silenciosa.     |
| Leitor                | Consultar snapshots e exportações liberadas.                                       | Criar cenários ou acessar outros tenants. |

## Requisitos funcionais por wave

| Wave | Entregável                                                  | Critério de aceite                                                         |
| ---- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0    | Especificação, ADR, inventário de fontes e matriz QA        | Nenhuma decisão técnica relevante fica sem registro de evidência ou risco. |
| 1    | Motor, modelo de domínio, formula registry e dados dourados | Projeção de 120 meses é reproduzível e passa invariantes.                  |
| 2    | Builder, custos, workforce, captação, capacidade e carteira | Inputs pendentes aparecem como pendentes e não são convertidos em valores. |
| 3    | Cenários, baseline, Goal Seek, Capital Envelope e approval  | Baseline não muda; branch e plano reverso mantêm trilha.                   |
| 4    | Boardroom e memória de cálculo                              | Builder e Boardroom exibem o mesmo snapshot e cada KPI abre explicação.    |
| 5    | PDF/PPTX e biblioteca histórica                             | Exportação falha de forma explícita para snapshot não autorizado.          |
| 6    | Regressão, segurança, performance e RC                      | Testes financeiros, autorização e auditoria adversarial aprovados.         |

## Critérios funcionais críticos

| ID    | Requisito            | Aceite objetivo                                                                                       |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------- |
| FR-01 | Horizonte financeiro | O motor aceita de 1 a 120 meses e rejeita fora dessa faixa.                                           |
| FR-02 | Métricas             | Receita, custo, caixa, NPV, IRR e Payback são calculados sem `number` no núcleo.                      |
| FR-03 | Proveniência         | KPI relevante retorna explicação com fórmula, versão, inputs e dependências.                          |
| FR-04 | Pendente             | Input pendente é persistido com status explícito e bloqueia validações dependentes quando necessário. |
| FR-05 | Baseline             | Após congelamento, mutação direta falha; alteração requer branch.                                     |
| FR-06 | Cenários             | Todo branch conserva parent version, delta de inputs e snapshot calculado.                            |
| FR-07 | Goal Seek            | Resultado informa variável, bounds, convergência, iterações e erro residual.                          |
| FR-08 | Boardroom            | O indicador apresentado vem de snapshot identificado, não de cálculo de componente.                   |
| FR-09 | Exportação           | Só snapshot validado e aprovado pode entrar na fila de PDF/PPTX.                                      |
| FR-10 | Histórico            | Biblioteca comparativa não preenche campos do projeto atual automaticamente.                          |
