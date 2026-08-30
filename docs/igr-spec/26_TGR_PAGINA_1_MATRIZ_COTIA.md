# TGR Consulting — Página 1 Canônica: Matriz Operacional Cotia

## Regra de fidelidade

Esta é a **primeira página do TGR Consulting**. Ela não é inspiração, não é wireframe e não é “uma versão mais moderna” da folha Cotia. É a própria matriz operacional convertida em formulário editável, com cálculos derivados protegidos. O usuário preenche as células de decisão; o TGR calcula totais, custos por cota, meses, carteira e impacto posterior.

> Onde a imagem não deixa a semântica fechada, o campo entra como **PENDENTE** com tooltip de definição. O sistema não batiza ambiguidade de fórmula só porque alguém está com pressa na reunião.

## Bloco A — Produto, estoque e condição comercial

| Linha da matriz Cotia       | No TGR                                                    | Natureza                                          |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| Nome do projeto / praça     | Identificação da operação.                                | Campo editável.                                   |
| Valor da cota               | Preço unitário da cota.                                   | Campo monetário.                                  |
| Valor da entrada            | Valor total de entrada por cota.                          | Campo monetário.                                  |
| Parcelas da entrada         | Quantidade de parcelas da entrada.                        | Campo inteiro.                                    |
| Valor da parcela da entrada | Entrada ÷ parcelas.                                       | Derivado e bloqueado.                             |
| Cotas por apartamento       | Frações/cotas comercializáveis por UH.                    | Campo inteiro.                                    |
| Total de apartamentos       | Estoque físico do produto.                                | Campo inteiro.                                    |
| Total de cotas              | Cotas/apartamento × apartamentos, ajustado por bloqueios. | Derivado; bloqueios são campo adicional.          |
| Eficiência                  | Taxa de eficiência da operação comercial.                 | Campo percentual com definição obrigatória.       |
| Valor da cortesia           | Valor/concessão promocional por cota, se aplicável.       | Campo monetário ou PENDENTE.                      |
| Taxa de cancelamento        | Cancelamento da venda/carteira.                           | Campo percentual com base e momento obrigatórios. |
| VGV potencial               | Valor da cota × cotas vendáveis.                          | Derivado e bloqueado.                             |
| Entrada potencial           | Valor da entrada × cotas vendáveis.                       | Derivado e bloqueado.                             |
| Cotas vendidas por mês      | Ritmo de venda contratado pela operação.                  | Campo decimal.                                    |
| Meses de operação           | Total de cotas ÷ cotas/mês, arredondado conforme regra.   | Derivado, com override de cenário.                |

## Bloco B — Carteira e comissão por cota

| Linha da matriz Cotia                   | No TGR                                               | Natureza                                            |
| --------------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Percentual adimplente da carteira       | Meta/regra de carteira saudável.                     | Campo percentual; semântica PENDENTE até definição. |
| Comissão por cota do corretor           | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota do fechador           | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota do captador           | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota de líder de captação  | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota de sublíder           | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota de gerente de sala    | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Comissão por cota de gerente financeiro | Valor pago por cota conforme política.               | Campo monetário.                                    |
| Profissionais por papel                 | Quantidade/participação da pirâmide.                 | Campo inteiro ou regra de rateio.                   |
| Comissão total por cota vendida         | Soma das linhas aplicáveis segundo a política ativa. | Derivado e auditável.                               |

## Bloco C — Pós-venda e sala de vendas

| Linha da matriz Cotia                                                                             | No TGR                                                            | Natureza                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Número de consultores de pós-venda                                                                | Headcount da célula.                                              | Campo inteiro.                                |
| Contratos por consultor                                                                           | Capacidade mensal ou por operação; unidade obrigatória.           | Campo inteiro com unidade explícita.          |
| Salário, almoço, transporte e encargos                                                            | Custo por consultor/por mês.                                      | Campos monetários.                            |
| Percentual adicional de encargos                                                                  | Encargos/benefícios incidentes.                                   | Campo percentual.                             |
| Tempo previsto                                                                                    | Horizonte da célula de pós-venda.                                 | Campo inteiro em meses ou herdado do projeto. |
| ADM/Contratos, Sala Kids, Recepção, Líder ADM/Financeiro, Gerente ADM, Garçom, Limpeza, Segurança | Quantidade, salário, mês de entrada e custo carregado por função. | Grade editável.                               |
| Passagem e refeição                                                                               | Valor unitário, elegíveis, dias e encargos.                       | Campos monetários/inteiros.                   |
| Total mensal da sala                                                                              | Soma de funções, benefícios, passagem, refeição e encargos.       | Derivado e bloqueado.                         |
| Total no período de operação                                                                      | Total mensal × cronograma de cada função.                         | Derivado e bloqueado.                         |

## Bloco D — Custos operacionais e implantação

| Linha da matriz Cotia                                       | No TGR                                                                      | Natureza                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| Energia elétrica, aluguel, IPTU e água                      | Média mensal e duração.                                                     | Campo monetário com recorrência. |
| Aluguel de carro com motorista                              | Valor por carro, quantidade, custo mensal e duração.                        | Grade editável.                  |
| Aluguel de impressoras                                      | Valor unitário, quantidade e duração.                                       | Grade editável.                  |
| Material de limpeza, descartáveis e copa                    | Custo mensal e duração.                                                     | Campo monetário com recorrência. |
| Marketing, TI, sistema comercial e administração financeira | Custo mensal, centro de custo e duração.                                    | Grade editável.                  |
| Jurídico e contabilidade                                    | Custo mensal, início e duração.                                             | Grade editável.                  |
| Custo operacional mensal                                    | Soma das linhas de OPEX, pessoal e comissões conforme regra de competência. | Derivado e bloqueado.            |
| Custo total da operação                                     | Cronograma mensal de custos no horizonte do estudo.                         | Derivado e bloqueado.            |

## Bloco E — Entrada e meios de pagamento

| Linha da matriz Cotia                          | No TGR                                                          | Natureza                                                                |
| ---------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Valor mensal referente ao pagamento da entrada | Entrada recebida projetada no mês.                              | Derivado de vendas e condição comercial; override de cenário permitido. |
| Cartão de crédito à vista                      | Percentual do mix, taxa MDR, prazo de liquidação e antecipação. | Campos percentuais/monetários.                                          |
| Cartão parcelado                               | Percentual do mix, parcelas, MDR, prazo e antecipação.          | Campos percentuais/inteiros.                                            |
| Débito                                         | Percentual do mix, taxa e prazo de liquidação.                  | Campos percentuais.                                                     |
| Crédito recorrente/cheque                      | Percentual do mix, taxa, inadimplência e calendário.            | Campos percentuais.                                                     |
| Boleto                                         | Percentual do mix, prazo, inadimplência e recuperação.          | Campos percentuais.                                                     |
| Total recebido líquido de entrada              | Distribuição por meio − taxas financeiras − perdas aplicáveis.  | Derivado e auditável.                                                   |

## O que a Página 1 alimenta

| Decisão na folha Cotia          | Páginas que devem reagir                                        |
| ------------------------------- | --------------------------------------------------------------- |
| Produto, cotas, preço e entrada | Venda, Receita, Carteira, Caixa, Indicadores e Conclusão.       |
| Ritmo de vendas e eficiência    | Venda, Captação, Sala, Comissão, Caixa e Cenários.              |
| Pirâmide de comissão            | Receita, DRE, Caixa, Margem, VPL/TIR/Payback.                   |
| Pós-venda e sala                | Operação, OPEX, Caixa, Vale de caixa e Capital Envelope.        |
| Custos de infraestrutura        | CAPEX/OPEX, Caixa, Payback e decisão.                           |
| Mix de recebimento              | Receita líquida, Carteira, Fluxo de Caixa, Cash Cliff e riscos. |

## Fora da Página 1

Não colocar aqui cenário, Goal Seek, aprovação, baseline, PDF/PPTX ou memória de cálculo. Eles existem **depois** que a Página 1 gerou o estudo. Misturar tudo nesta folha é voltar para a planilha possuída que o TGR veio matar.
