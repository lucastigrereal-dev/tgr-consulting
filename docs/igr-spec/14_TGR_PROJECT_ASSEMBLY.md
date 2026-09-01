# TGR — Ficha de Montagem do Projeto

## Função da ficha

A Ficha de Montagem é a primeira conversa do TGR. Ela substitui o gesto de abrir o PDF no meio e catar tabela igual caça ao tesouro de contador. O usuário define **que projeto existe, quando ele começa, quanto custa para nascer e como vende**. A partir daí, o motor alimenta capítulos, demonstrativos, indicadores, narrativa e apresentação.

## Decisões fundadoras

| Bloco                | Decisão                                                                                 | Alimenta diretamente                                        |
| -------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Identidade           | Nome, praça, produto, data-base, início, horizonte e moeda.                             | Capa, cronograma, versão e recortes mensais.                |
| Produto              | Unidades, frações, estoque inicial, mês de liberação e reservas.                        | Estoque, sell-out, VGV e limite de venda.                   |
| Investimento inicial | CAPEX, implantação, marketing pré-operacional, sistemas, legalização e capital de giro. | Desembolso inicial, necessidade de capital e payback.       |
| Comercial            | Ticket, desconto, entrada, parcelas, taxa de recebimento e cancelamento.                | Receita, carteira, recebimento e fluxo de caixa.            |
| Meta e captação      | Vendas por mês, casais qualificados, conversão e crescimento de captação.               | Funil, volume comercial, receita e necessidade de canal.    |
| Sala e equipe        | Captadores, recepção, consultores, closers, dias, turnos e capacidade.                  | Gargalo operacional, produtividade, folha e venda possível. |
| Custos               | Folha, custo fixo, variável, comissão, parceiro, imposto e OPEX.                        | DRE, margem, caixa e break-even.                            |
| Capital              | Reserva, desconto, dívida opcional e caixa mínimo.                                      | Capital Envelope, VPL, TIR e risco financeiro.              |

## Versão rápida: decisão de reunião

A primeira versão deve pedir apenas o suficiente para montar a narrativa e as primeiras tabelas. Estes campos correspondem ao nível de planejamento rápido do TGR:

| Pergunta de reunião                    | Campo financeiro atual       | Saída imediata                 |
| -------------------------------------- | ---------------------------- | ------------------------------ |
| Quantos casais entram no primeiro mês? | `qualifiedCouplesMonth1`     | Volume comercial inicial.      |
| A captação cresce quanto ao mês?       | `qualifiedCouplesGrowthRate` | Timeline de qualificados.      |
| Qual conversão realista?               | `conversionRate`             | Vendas e receita potencial.    |
| Qual ticket médio?                     | `averageTicket`              | Receita bruta e VGV comercial. |
| Quanto efetivamente recebe?            | `collectionRate`             | Caixa e carteira.              |
| Quanto cancela?                        | `cancellationRate`           | Receita líquida e recebíveis.  |
| Quanto custa vender?                   | `variableCostRate`           | Custo variável e margem.       |
| Qual repasse a parceiros?              | `partnerShareRate`           | Comissões e desembolso.        |
| Qual custo fixo mensal?                | `fixedCostMonthly`           | DRE e break-even.              |
| Quanto custa a folha?                  | `payrollMonthly`             | DRE, capacidade e caixa.       |
| Qual investimento inicial?             | `capexInitial`               | Caixa inicial e payback.       |
| Qual taxa de desconto?                 | `discountRateAnnual`         | VPL e decisão de capital.      |

## Regra de apresentação viva

> Se uma decisão inicial mudar, o TGR precisa apontar **qual capítulo mudou, qual tabela foi recalculada, qual KPI variou, qual alerta nasceu e se a exportação ainda representa a versão aprovada**.

A decisão “tirar dois captadores”, por exemplo, não pode virar só alteração de headcount. Ela deve percorrer capacidade de captação, casais qualificados, vendas possíveis, receita, folha, caixa, capital e conclusão. Quando a fórmula canônica de um elo ainda não existir, o TGR declara o elo como pendente em vez de forjar impacto.
