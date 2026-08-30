# TGR — Matriz de Demonstrativos do Estudo-Base

## O que o PDF realmente prova

O estudo Marítimo Pipa é construído de trás para frente a partir das decisões iniciais: contrato, entrada, prazo, cotas, inadimplência, eficiência, cancelamento, investimento pré-operacional, vendas e estrutura de custos. Cada cenário repete uma cadeia de receita, custo variável, repasse, fluxo de caixa e indicadores. No TGR, isso deve ser **uma engine com cenários**, não três relatórios paralelos.

| Linha do PDF                                 | Decisão que alimenta                                     | Saída mensal do estudo vivo                       | Estado no TGR                                                                     |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Valor do contrato, entrada, parcelas e prazo | Produto, preço e condição comercial                      | Entrada, parcelas, receita e carteira por coorte  | A estruturar em formula set de recebíveis.                                        |
| Cotas, vendas e eficiência                   | Estoque, meta, funil e capacidade                        | Vendas totais, líquidas, acumuladas e ativas      | Core já calcula qualificados, contratos e venda; estoque/coorte é próxima versão. |
| Investimento pré-operacional                 | Material, sala, maquete, legalização, sistemas e capital | CAPEX por mês e resultado acumulado               | Core já suporta CAPEX inicial; cronograma por rubrica é próxima versão.           |
| Custos variáveis                             | Comissão, pós-venda, brindes, taxa e imposto             | Custo variável, margem e lucro líquido            | Core já suporta taxa agregada; decomposição é próxima versão.                     |
| Custos de pessoal                            | Função, quantidade, salário, encargos e ramp-up          | Folha, custo carregado e custo fixo por período   | Inputs/Workforce existem; curva mensal canônica é próxima versão.                 |
| Custos fixos                                 | Sala, operação, administração, tecnologia e serviços     | OPEX, margem e DRE                                | Core já suporta custo fixo agregado; catálogo detalhado já existe.                |
| Repasses a parceiros                         | Percentual, base de incidência e cronograma              | Repasse mensal e caixa do parceiro                | Core já suporta taxa agregada; base/cronograma é próxima versão.                  |
| Fluxo de caixa                               | Todas as linhas anteriores + obra/aquisição/dívida       | Receita, imposto, margem, lucro livre e acumulado | Core entrega receita/custos/caixa; DRE expandida é próxima versão.                |
| Indicadores                                  | Fluxo descontado e curva de caixa                        | VPL, TIR, Payback e conclusão                     | Já autoritativo no core.                                                          |

## Linhas da Apresentação Viva

A apresentação em reunião deve começar por estes sete blocos, na ordem do PDF e da decisão do cliente:

1. **Premissas do projeto:** identidade, produto, preço, condição, estoque e cronograma.
2. **Investimento de partida:** pré-operacional, sala, implantação, capital e ativos opcionais.
3. **Tração comercial:** funil, capacidade, vendas mensais, eficiência e estoque ativo.
4. **Receita e carteira:** entrada, parcelas, recebimento, cancelamento e receita total.
5. **Custos e margem:** variável, parceiros, folha, fixo e margem de contribuição.
6. **Caixa e capital:** lucro livre, fluxo acumulado, break-even e necessidade de caixa.
7. **Decisão:** VPL, TIR, Payback, riscos, cenários e recomendação.

## Regra para próximas fórmulas

Cada linha nova do PDF deve entrar como: **campo da Montagem → definição de fórmula → teste de regressão → memória de cálculo → linha do demonstrativo → impacto no Boardroom**. O TGR não copiará valores de Pipa; ele copiará a gramática do estudo e recalculará com decisões de cada novo projeto.
