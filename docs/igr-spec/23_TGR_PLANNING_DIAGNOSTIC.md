# Diagnóstico de Planejamento — TGR Consulting

## Veredito direto

O **TGR Consulting não é um dashboard financeiro**. Ele é o sistema de planejamento de uma operação de multipropriedade, cuja interface final se comporta como o próprio estudo de viabilidade. A lógica correta está confirmada: a ficha compacta de Cotia é a abertura configurável; o estudo de Marítimo/Pipa é o desdobramento completo; o TGR precisa converter as decisões iniciais em páginas, tabelas, cenários, indicadores e conclusão que se atualizam em cascata.

O projeto atual já possui uma fundação de decisão mais séria do que uma planilha comum. O risco não é faltar tela; é construir tela antes de publicar a regra matemática que a sustenta. A recomendação é parar de expandir painéis soltos e evoluir por **cadeias completas de decisão**.

## O que já existe de verdade

| Camada | Estado atual | Valor para o TGR |
|---|---|---|
| Projeto, versão e baseline | Implementados com estados, histórico e bloqueio de mutação. | Permite modelar hipóteses sem destruir o estudo aprovado. |
| Premissas e proveniência | Input com status, fonte, decisão e audit trail. | Impede hipótese de virar fato escondido. |
| Núcleo determinístico | Projeção mensal de até 120 meses, decimal, VPL, TIR, Payback e memória de cálculo. | É a espinha do estudo vivo. |
| Montagem do Projeto | Primeira ficha com identidade, início, produto, investimento e alavancas financeiras básicas. | É a semente correta, mas ainda precisa virar a única porta de entrada. |
| Cenários e simulação | Branches, baseline e cópia de reunião para captadores, ticket e custo fixo. | Já prova o princípio de “muda aqui, vê lá”. |
| Boardroom / Estudo Vivo | Snapshot, impacto, conclusão, demonstrativo mensal e exportação governada. | Já é o embrião da apresentação viva. |
| Catálogo de custos e workforce | Estrutura persistida e economics base. | Dá suporte à montagem da operação, ainda sem todas as regras por papel/corte. |

## Evidência canônica e leitura da implementação

O **Master Blueprint v2.0** determina a sequência Planejar → Simular → Decidir → Apresentar → Aprovar → Exportar, modelo de dados unificado, fórmulas protegidas, versões imutáveis e cálculo decimal. Também determina que V1 continua focada em multipropriedade e não precisa absorver CRM transacional, Real x Planejado, parecer fiscal ou IA gerativa. O **log mestre de decisões** reforça um horizonte padrão de dez anos, comissionamento ligado à entrada recebida, caixa de segurança e cenários ilimitados protegidos por baseline.

| Fonte de implementação inspecionada | Evidência observada | Lacuna que direciona o plano |
|---|---|---|
| `Builder.tsx` | Oito domínios, fonte obrigatória, status pendente, Ficha de Montagem e bloqueio de cálculo com alteração não salva. | Captação e workforce ainda são registros; faltam fórmulas canônicas conectadas ao motor. |
| `Boardroom.tsx` | KPIs, impacto entre snapshots, simulação de captador/ticket/custo, memória, aprovação, baseline e exportação. | Precisa amadurecer páginas do documento e demonstrativos completos, não novos cards. |
| `engine.ts` | Decimal, 120 meses, funil simples, VPL, TIR, Payback e memória de cálculo. | Ainda não modela sazonalidade vetorial, indexadores, carteira complexa, CAPEX recorrente ou regras do PDF. |
| `routers/igr.ts` | Contratos protegidos para projeto, decisão, custo, cenário, Goal Seek, aprovação e exportação. | Fórmulas seguem fixas na V1; faltam cargas em lote, RBAC granular e notificações. |
| `db.ts` | Tenant, versões, snapshots, audit/workflow events, custos, benchmarks, decisões e baseline. | Falta definir RBAC operacional, soft delete e ciclo de importação em massa. |

> **Conclusão da inspeção:** a fundação não deve ser reescrita. O TGR já tem motor, governança, versionamento e apresentação. O próximo ciclo precisa conectar a matemática canônica do negócio aos domínios que hoje só armazenam dados.

## O que ainda não deve ser vendido como pronto

| Lacuna | Por que importa | Decisão de planejamento |
|---|---|---|
| Condição comercial completa | Entrada, saldo, parcelas, correção, juros e reconciliação ainda não alimentam a carteira por coorte. | Prioridade máxima: sem preço reconciliado não existe viabilidade confiável. |
| Produto multiproduto | Estoque, tipos de unidade, frações e fases de preço não produzem VGV detalhado. | Criar um motor de produto e estoque antes de sofisticar gráficos. |
| Canais de captação | Os canais estão cadastráveis, mas não operam como centros de custo/capacidade/qualidade independentes. | Tratar Canal → Ponto → Turno → Equipe como cadeia econômica. |
| Workforce por função | Há economics agregados, não cohorts completos por cargo, data de contratação, D15/D30/D60/D90 e produtividade. | Modelar por função antes de prometer dimensionamento fino. |
| Comissão e incentivos | Estrutura existe, mas não há política versionada conectada a bases e gatilhos de recebimento. | Construir um builder de remuneração com regras auditáveis. |
| Recebíveis e perdas | Taxas básicas existem, mas faltam coortes, aging, recuperação e conciliação por meio de pagamento. | Criar o motor de carteira depois da condição comercial. |
| Páginas do PDF | O Boardroom ainda tem elementos de dashboard e somente um demonstrativo mensal compacto. | Evoluir para documento sequencial depois das fórmulas canônicas. |

## Sequência de construção recomendada

> **Primeiro a regra que responde à pergunta do negócio. Depois a página que explica a resposta. Por último o gráfico bonito que o cara tira foto.**

1. **Ficha-Mãe e condição comercial reconciliada.** Produto, estoque, preço, entrada, saldo, parcelas e prazo precisam fechar matematicamente.
2. **Venda e unit economics.** Converter meta de contratos em canais, pontos, turnos, captadores, custo por casal e custo por venda saudável.
3. **Operação e workforce.** Transformar headcount em cronograma, custo carregado, ramp-up, produtividade, turnover e capacidade real.
4. **Receita, carteira e caixa.** Projetar recebimento por coorte, cancelamento, inadimplência, recuperação, custos, CAPEX/OPEX e vale de caixa.
5. **Estudo-PDF vivo.** Somente então espelhar o PDF em páginas de venda, receita, custo, caixa, cenários, indicadores e conclusão.

## Regra de escopo para o próximo ciclo

Cada módulo novo só entra quando responder simultaneamente a três perguntas: **qual decisão ele sustenta, qual variável ele recebe e qual página/KPI ele altera**. Se não responder às três, vai para backlog. Isso impede o TGR de virar um shopping de abas com cara de sistema caro e miolo de planilha de condomínio.

## Fontes internas lidas

- Descrição oficial do sistema TGR (`pasted_content_3.txt`).
- Estudo de Viabilidade Marítimo/Pipa, 39 páginas.
- Referência operacional Cotia.
- Modelo de Documento Vivo TGR, matriz de demonstrativos e contratos de fórmula.
- Implementação atual, documentação e TODO do projeto.
- Blueprint canônico `IGR_Consulting_MASTER_BLUEPRINT.md` e log `DECISIONS_CHAT_MASTER.md`.
- Inspeção explícita de `Builder.tsx`, `Boardroom.tsx`, `engine.ts`, `routers/igr.ts` e `db.ts`.
