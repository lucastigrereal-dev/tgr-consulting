# TGR — Ficha-Mãe para Estudo Vivo

## Constatação central

O PDF de Pipa de 39 páginas não é uma peça independente de Cotia. Ele é uma **ficha de abertura desdobrada**: as premissas de produto, pagamento, estoque, venda, operação e custo alimentam uma sequência repetível de receitas, custos variáveis, repasses, fluxo de caixa e indicadores por cenário.

No TGR, essa sequência deixa de ser montada manualmente em planilha. A **Ficha-Mãe** é preenchida uma vez; cada capítulo é calculado e mantido no mesmo `CalculationSnapshot`.

## Desdobramento automático

| Ficha-Mãe — decisão inicial                          | Fórmula / transformação                      | Capítulo do estudo no estilo Pipa               | Saída para a reunião                          |
| ---------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| Apartamentos × cotas por apartamento                 | `cotas totais`                               | Premissas gerais                                | Estoque total e disponível.                   |
| Valor da cota × cotas totais                         | `VGV`                                        | Premissas gerais                                | Receita potencial do projeto.                 |
| Entrada, parcelas, prazo, juros e mix de meios       | cronograma de recebimento por coorte         | Projeção de receitas                            | Entrada, parcelas, receita mensal e carteira. |
| Meta/capacidade de venda e eficiência                | vendas brutas, líquidas, acumuladas e ativas | Projeção de vendas                              | Ritmo comercial, fim de estoque e gargalos.   |
| Inadimplência, cancelamento e recuperação            | receita líquida e carteira adimplente        | Projeção de receitas                            | Risco de recebimento e perda.                 |
| Comissão por papel e gatilho                         | custo por cota e por mês                     | Custos variáveis                                | Custo comercial e margem.                     |
| Parceiro, repasse e base de incidência               | repasse mensal                               | Projeção de repasses                            | Participação e caixa do parceiro.             |
| Funções, salários, encargos, benefícios e ramp-up    | folha por mês                                | Custos de pessoal / custos fixos                | Estrutura operacional e break-even.           |
| Sala, energia, aluguel, frota, TI, jurídico e outros | OPEX por rubrica e duração                   | Custos fixos gerais                             | OPEX mensal e anual.                          |
| Material, maquete, implantação, obra e ativo         | CAPEX por mês                                | Investimentos pré-operacionais / fluxo de caixa | Necessidade de caixa e curva de implantação.  |
| Receita recebida − custos − repasses − CAPEX         | fluxo livre e acumulado                      | Fluxo de caixa                                  | Caixa, vale de caixa e ponto de equilíbrio.   |
| Fluxo descontado                                     | VPL, TIR, Payback e indicadores              | Indicadores financeiros                         | Recomendação e decisão.                       |

## Ordem certa de apresentação

A conversa começa na Ficha-Mãe, não no fluxo de caixa. O apresentador monta o projeto com o cliente, calcula e navega pelos capítulos já preenchidos. A apresentação viva deve abrir nesta ordem:

1. **O projeto:** produto, praça, estoque, preço e condição.
2. **A venda:** meta, capacidade, eficiência, estoque e prazo de comercialização.
3. **O recebimento:** entrada, parcelas, meios de pagamento, perdas e carteira.
4. **A operação:** equipe, sala, parceiros, comissões e custos.
5. **O dinheiro:** CAPEX, caixa, fluxo acumulado, VPL, TIR e Payback.
6. **A decisão:** cenário, alavancas, riscos, recomendação e exportação.

## Regras de interação em reunião

| Alteração em reunião         | Recalcular automaticamente                                          | Explicação visível                                                      |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Remover dois captadores      | Captação, vendas, comissão, folha, receita, caixa, VPL e Payback.   | Menos capacidade; possível economia de folha; impacto líquido no caixa. |
| Aumentar ticket              | VGV, entrada, parcelas, recebimento, repasse, imposto, caixa e VPL. | Mais valor por contrato; verificar conversão e preço de mercado.        |
| Mudar entrada/prazo          | Entrada em caixa, recebimento por coorte, carteira e vale de caixa. | O projeto pode vender igual e ficar sem dinheiro antes de receber.      |
| Alterar conversão            | Vendas, fim de estoque, receita, comissão, caixa e Payback.         | A mudança comercial aparece no financeiro sem reescrever tabela.        |
| Alterar headcount/custo fixo | Folha, OPEX, margem, break-even, caixa e VPL.                       | Custo recorrente sobe/baixa mesmo quando a venda não muda.              |
| Alterar CAPEX/cronograma     | Caixa inicial, vale de caixa, VPL e necessidade de capital.         | O início da operação pode ser viável no resultado e inviável no caixa.  |

## Limite de implementação atual

O TGR já possui Ficha de Montagem, cálculo decimal de premissas financeiras, snapshot, demonstrativo mensal, impacto de snapshot e simulação de captadores/ticket/custo fixo. Para reproduzir as 39 páginas como estudo vivo, as próximas fórmulas canônicas são:

1. cronograma de entrada e parcelas por coorte;
2. estoque, venda ativa e fim de comercialização;
3. comissões por papel e gatilho;
4. folha/ramp-up por função;
5. OPEX e CAPEX por rubrica e período;
6. repasses e impostos por base de incidência;
7. DRE e fluxo de caixa expandido.

Nenhuma delas deve usar valor de Cotia ou Pipa como default. A referência ensina a **estrutura**; o novo projeto fornece os dados ativos.
