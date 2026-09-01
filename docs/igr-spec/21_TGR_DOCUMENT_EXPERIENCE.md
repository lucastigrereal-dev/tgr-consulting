# TGR — Experiência do Sistema-PDF Vivo

## Interface principal

O TGR abre em **modo documento**, não em modo dashboard. À esquerda, uma navegação de páginas; ao centro, a página viva selecionada; à direita, quando houver alteração, uma faixa de impacto. Em celular, a navegação vira uma faixa horizontal de capítulos e o documento mantém leitura contínua.

| Elemento             | Função                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Navegador de páginas | Levar da página 1 à 10 em sequência, mostrar estado e pendências.                            |
| Página de estudo     | Misturar explicação executiva, campo editável, tabela calculada e memória de cálculo.        |
| Barra de impacto     | Avisar quais páginas serão recalculadas antes de aplicar uma decisão.                        |
| Modo reunião         | Rodar alavancas em cópia temporária, comparar antes/depois e permitir promover para cenário. |
| Faixa de status      | Exibir Rascunho, Pendências, Calculado, Aprovado ou Baseline.                                |

## Composição de cada página

Cada página deve obedecer a três faixas: **o que está sendo decidido**, **a tabela que prova a consequência** e **o que o comitê precisa fazer agora**. O usuário nunca encontra KPI isolado sem premissa, nem formulário sem impacto.

| Página      | Decisão                                       | Demonstração                             | Ação                           |
| ----------- | --------------------------------------------- | ---------------------------------------- | ------------------------------ |
| Montagem    | Produto, preço, prazo, investimento e início. | Estoque, VGV e resumo de premissas.      | Salvar e calcular.             |
| Venda       | Captação, eficiência e equipe.                | Funil, capacidade, estoque e cronograma. | Ajustar alavancas.             |
| Receita     | Entrada, parcelas, carteira e perdas.         | Receita por mês/coorte e recebimento.    | Revisar condição.              |
| Operação    | Pessoas, sala e OPEX.                         | Folha, custos e break-even.              | Redimensionar estrutura.       |
| Caixa       | CAPEX, custos e recebimento.                  | Fluxo mensal, acumulado e vale de caixa. | Proteger capital.              |
| Indicadores | Taxa de desconto e cenários.                  | VPL, TIR, Payback e risco.               | Aprovar ou revisar.            |
| Conclusão   | Decisão do comitê.                            | Racional, memória e hash.                | Aprovar, congelar ou exportar. |

## Calculadora de alavancas

A calculadora fica contextualizada na página que ela altera. Captador aparece em Venda/Operação; ticket em Produto/Receita; custo fixo em Operação/Caixa; CAPEX em Montagem/Caixa. O resultado sempre mostra **custo marginal, ganho marginal, break-even e efeito nos indicadores**. A cópia de reunião nunca substitui a página oficial automaticamente.
