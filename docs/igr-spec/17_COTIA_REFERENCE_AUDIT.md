# Cotia — Auditoria da Referência de Operação

> **Fonte:** imagem de referência “HOSPEDAR/DA MATA RES./COTIA-SP”, enviada pelo usuário. Esta é uma leitura estruturante; células de baixa legibilidade ou de semântica ambígua foram marcadas para confirmação, nunca convertidas em premissa autoritativa.

## O que a referência mostra

Cotia não é ainda o estudo inteiro. Ela é a **folha de nascimento da operação**: produto, estoque, ritmo comercial, comissão, pós-venda, sala, custos operacionais e recebimento da entrada. O PDF de Pipa mostra como essas decisões viram cenário, receita, custos, caixa, VPL, TIR e Payback. O TGR deve unir os dois: **Cotia preenche o começo; o modelo vivo entrega o resto**.

| Bloco da referência    | Leitura estruturante                                                  | Papel no TGR                    |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------- |
| Produto e estoque      | Cota, apartamentos, cotas por apartamento, estoque e VGV.             | Montagem → Produto e preço.     |
| Condição comercial     | Entrada, parcelas, prazo e mix de recebimento.                        | Montagem → Receita e carteira.  |
| Ritmo de vendas        | Cotas vendidas por mês, meses de operação, eficiência e cancelamento. | Montagem → Comercial → Receita. |
| Comissão de venda      | Papéis, custo por cota e quantidade de profissionais.                 | Comercial → Custo variável.     |
| Pós-venda              | Consultores, capacidade por consultor, salário e benefícios.          | Operação → Workforce/Carteira.  |
| Sala de vendas         | Funções, headcount, salários, passagem, refeição e encargos.          | Operação → Custo fixo.          |
| OPEX de suporte        | Energia, aluguel, frota, impressoras, limpeza, tecnologia e jurídico. | Operação → Catálogo de custos.  |
| Recebimento da entrada | Mix de cartão, débito, recorrência/cheque e boleto.                   | Receita → Caixa.                |

## Números legíveis para cadastro inicial

| Premissa                      |                                                                     Valor lido | Classificação                                     |
| ----------------------------- | -----------------------------------------------------------------------------: | ------------------------------------------------- |
| Valor da cota                 |                                                                   R$ 35.000,00 | Confirmar cenário/preço-base.                     |
| Valor da entrada              |                                                                    R$ 4.500,00 | Confirmar se é por cota antes de desconto.        |
| Parcelas                      |                                                                             96 | Confirmar se é o saldo total.                     |
| Valor da parcela mostrado     |                                                                      R$ 317,71 | Confirmar cálculo e incidência de juros/correção. |
| Cotas por apartamento         |                                                                             52 | Estrutura de produto.                             |
| Apartamentos                  |                                                                             40 | Estrutura de produto.                             |
| Cotas totais                  |                                                                          2.080 | Derivado de 52 × 40.                              |
| VGV mostrado                  |                                                               R$ 72.800.000,00 | Coerente com 2.080 × R$ 35.000,00.                |
| Entrada total mostrada        |                                                                R$ 9.360.000,00 | Coerente com 2.080 × R$ 4.500,00.                 |
| Cotas vendidas por mês        |                                                                             52 | Confirmar meta versus capacidade.                 |
| Meses de operação             |                                                                             40 | Confirmar janela de vendas.                       |
| Eficiência                    |                                                                            10% | Definição ainda ambígua.                          |
| Taxa de cancelamento          |                                                                            30% | Confirmar momento e base de incidência.           |
| Comissão por cota             |                                                                    R$ 3.345,00 | Soma exibida da pirâmide comercial.               |
| Consultores de pós-venda      |                                                                              6 | Confirmar ramp-up.                                |
| Contratos por consultor       |                                                                            260 | Confirmar se é teto de carteira ativa.            |
| Salário de consultor          |                                                                    R$ 1.850,00 | Base de custo de pós-venda.                       |
| Total fixo da sala mostrado   |                                                               R$ 93.200,00/mês | Confirmar composição e encargos.                  |
| Operação + comissão mostrado  |                                                              R$ 544.892,00/mês | Confirmar se inclui todos os custos e impostos.   |
| Mix de recebimento da entrada | 15% à vista/CC; 38% CC parcelado; 17% débito; 23% recorrente/cheque; 7% boleto | Base para cronograma de caixa.                    |

## Fórmulas que já aparecem na gramática da imagem

| Fórmula                                                                       | Forma no TGR                  | Estado                                               |
| ----------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- |
| `cotas totais = apartamentos × cotas por apartamento`                         | Fórmula de produto.           | Pronta para versionar.                               |
| `VGV = cotas totais × valor da cota`                                          | Indicador de projeto.         | Pronta para versionar.                               |
| `entrada total = cotas totais × entrada por cota`                             | Receita potencial de entrada. | Pronta para versionar.                               |
| `vendas por mês = capacidade comercial limitada por estoque`                  | Motor comercial.              | Exige definição de eficiência e distribuição mensal. |
| `comissão mensal = cotas vendidas × comissão por cota`                        | Custo variável.               | Pronta após confirmar gatilho de pagamento.          |
| `folha = headcount × custo carregado × ramp-up`                               | Custo de operação.            | Exige curva de contratação.                          |
| `entrada em caixa = entrada recebida × mix de meios × calendário`             | Caixa.                        | Exige prazo de liquidação por meio.                  |
| `caixa = receita recebida − comissão − custo variável − folha − OPEX − CAPEX` | Demonstrativo mensal.         | Depende dos itens acima.                             |

## O que não deve ser inferido

Não usar, sem confirmação, os números “75% do projeto adimplente”, “R$ 495.625,00” de carteira, “520/R$ 52.000,00”, percentuais de encargos, duração de alguns custos ou valores totais de pós-venda. Eles podem representar resultados de uma regra específica de Cotia, não uma regra universal.

## As 20 perguntas que destravam o estudo

|   # | Pergunta decisória                                                                                                                              | O que muda no estudo                    |
| --: | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
|   1 | Qual é o nome, praça, produto e data-base oficiais do projeto?                                                                                  | Identidade, capa e contexto de mercado. |
|   2 | Quantos apartamentos, cotas por apartamento e cotas realmente vendáveis existem?                                                                | Estoque, VGV e limite de vendas.        |
|   3 | Há estoque bloqueado, cortesia, permuta, reserva técnica ou cota não comercializável?                                                           | Estoque líquido e receita potencial.    |
|   4 | O preço de R$ 35 mil é preço-base, preço médio ou um cenário? Quais faixas existirão?                                                           | VGV, receita e cenários.                |
|   5 | A entrada de R$ 4,5 mil é fixa, percentual ou varia por campanha?                                                                               | Caixa inicial.                          |
|   6 | As 96 parcelas são saldo total? Há juros, correção, carência, balões ou parcelas intermediárias?                                                | Receita por coorte e carteira.          |
|   7 | Quando começam vendas e recebimentos? Os dois começam no mesmo mês?                                                                             | Cronograma do estudo.                   |
|   8 | As 52 cotas/mês são meta comercial, capacidade máxima ou histórico observado?                                                                   | Projeção de vendas.                     |
|   9 | O que significa eficiência de 10%: conversão, aproveitamento de estoque, inadimplência ou outra regra?                                          | Funil e vendas líquidas.                |
|  10 | O cancelamento de 30% incide em qual mês, sobre qual base e há recuperação de carteira?                                                         | Receita líquida e churn.                |
|  11 | O “75% do projeto adimplente” é meta de carteira, regra de repasse ou estimativa de recebimento?                                                | Caixa e resultado do parceiro.          |
|  12 | Quais cargos da comissão entram por venda, quais são fixos e em qual evento cada comissão é paga?                                               | Custo variável e fluxo de caixa.        |
|  13 | Quantos captadores, corretores, fechadores, líderes e gerentes entram no mês 1 e como cresce a equipe?                                          | Capacidade, folha e simulação.          |
|  14 | Os seis consultores de pós-venda entram desde o início? Os 260 contratos por consultor são teto de carteira ativa?                              | Pós-venda e ramp-up.                    |
|  15 | Os salários da imagem já incluem encargos, benefícios, transporte e refeição, ou estes são adicionais?                                          | Folha carregada.                        |
|  16 | Quais despesas de sala começam antes da primeira venda e quais terminam ao fim do estoque?                                                      | OPEX e break-even.                      |
|  17 | Energia, aluguel, frota, impressoras, TI, jurídico e contabilidade são por sala, por projeto ou rateados?                                       | Centro de custo e custo mensal real.    |
|  18 | Qual o prazo de liquidação de cada meio de pagamento da entrada e quais taxas financeiras existem?                                              | Fluxo de caixa mensal.                  |
|  19 | Quais impostos, repasses a parceiros, royalties ou comissões pós-venda incidem sobre a venda e sobre a carteira?                                | Margem, caixa e VPL.                    |
|  20 | Qual decisão a apresentação precisa sustentar: lançar, redimensionar equipe, mudar preço, captar capital, negociar parceiro ou aprovar cenário? | KPIs, alertas e conclusão.              |

## Próximo uso correto

Quando chegar o material completo de Pipa, ele deve ser usado para validar a **sequência editorial** e a família de demonstrativos. Cotia deve alimentar as premissas. O TGR nunca deve trazer valor de Pipa para completar buraco de Cotia; o buraco fica `PENDENTE` até decisão registrada.
