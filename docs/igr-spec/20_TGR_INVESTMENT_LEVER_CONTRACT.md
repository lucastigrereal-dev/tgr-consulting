# TGR — Contrato de Alavanca de Investimento

## Exemplo: Captador

Um captador não é somente “mais uma pessoa na folha”. No estudo vivo, ele é uma alavanca que altera a capacidade de qualificados, a venda provável, a receita recebida, os custos variáveis, a comissão, o caixa e os indicadores de retorno.

| Input da alavanca                | Unidade     | Regra                                                                      |
| -------------------------------- | ----------- | -------------------------------------------------------------------------- |
| Variação de captadores           | Pessoas     | Pode ser positiva ou negativa; não reduz o quadro abaixo de zero.          |
| Qualificados por captador/mês    | Casais/mês  | Capacidade incremental de topo de funil.                                   |
| Custo carregado por captador/mês | R$/mês      | Salário + encargos + benefícios que efetivamente variam com a contratação. |
| Conversão                        | %           | Vem da Ficha-Mãe ou cenário.                                               |
| Ticket médio                     | R$/contrato | Vem da Ficha-Mãe ou cenário.                                               |
| Taxa de recebimento              | %           | Percentual que entra no caixa no horizonte modelado.                       |
| Custo variável e repasse         | %           | Custos incidentes sobre receita.                                           |
| Comissão por contrato            | R$/venda    | Opcional até a regra comercial ser publicada.                              |

## Fórmulas explicadas

| Saída                        | Fórmula                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Qualificados incrementais    | `Δ captadores × qualificados por captador/mês`                                                              |
| Vendas incrementais          | `qualificados incrementais × conversão`                                                                     |
| Receita recebida incremental | `vendas incrementais × ticket × recebimento`                                                                |
| Contribuição antes de folha  | `receita recebida incremental × (1 − custo variável − repasse)`                                             |
| Comissão incremental         | `vendas incrementais × comissão por contrato`                                                               |
| Resultado mensal marginal    | `contribuição − comissão − custo carregado incremental`                                                     |
| Qualificados para break-even | `custo carregado / [conversão × ((ticket × recebimento × margem de contribuição) − comissão por contrato)]` |
| Efeito no estudo             | Reexecutar a projeção com a cópia de inputs e comparar caixa, VPL, TIR e Payback.                           |

Se o denominador do break-even for zero ou negativo, o TGR não finge existir resposta: mostra **“alavanca não paga a própria estrutura nas premissas atuais”**.

## Proteção de governança

A análise de alavanca é uma **cópia não persistente**. Ela só vira dado do projeto quando alguém registra uma decisão, cria um branch ou atualiza a versão de trabalho com fonte e responsável. Assim, a reunião pode brincar com “tira dois, põe um” sem destruir o estudo oficial igual moleque em planilha compartilhada.
