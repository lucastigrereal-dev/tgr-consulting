# TGR — Modelo de Documento Vivo

## O PDF é a aplicação

O TGR não terá um dashboard de um lado e um “relatório” de outro. A tela principal é o próprio **Estudo de Viabilidade**, apresentado como documento sequencial. Cada página tem identidade, campos, tabelas e leitura executiva; toda mudança de premissa se propaga para as páginas posteriores.

Para não aprisionar o usuário em 39 telas estáticas, a estrutura editorial do PDF de Pipa será mantida em **10 páginas vivas**. Ao exportar, cada página pode se expandir nos quadros e anexos equivalentes do PDF.

|               Página viva | Papel no estudo                                                 | Editável?                      | Depende de             |
| ------------------------: | --------------------------------------------------------------- | ------------------------------ | ---------------------- |
|         1. Capa e decisão | Projeto, praça, data-base, objetivo e status.                   | Sim.                           | Identidade do projeto. |
|    2. Montagem do projeto | Produto, estoque, preço, entrada, prazo, início e investimento. | Sim.                           | Ficha-Mãe.             |
|     3. Venda e capacidade | Meta, funil, captação, eficiência, equipe e estoque.            | Sim.                           | Montagem + operação.   |
|     4. Receita e carteira | VGV, entrada, parcelas, recebimento, perdas e cancelamento.     | Parcial.                       | Páginas 2 e 3.         |
|   5. Comissão e parceiros | Pirâmide comercial, gatilhos, repasses e custo por venda.       | Sim.                           | Página 3.              |
|      6. Operação e custos | Pós-venda, sala, folha, OPEX, CAPEX e ramp-up.                  | Sim.                           | Páginas 2 e 3.         |
|   7. Demonstrativo mensal | Vendas, receita, custo, caixa e acumulado por mês.              | Não; recalcula.                | Páginas 2–6.           |
|  8. Cenários e simulações | Cópias de reunião, mudanças de alavanca e comparativo.          | Sim, sem persistir por padrão. | Snapshot vigente.      |
|    9. Indicadores e risco | VPL, TIR, Payback, break-even, pendências e alertas.            | Não; recalcula.                | Página 7.              |
| 10. Conclusão e aprovação | Recomendação, memória de decisão, aprovação e exportação.       | Sim para decisão; números não. | Páginas 1–9.           |

## Regra de fluxo

> **O usuário começa na página 2. O TGR preenche, recalcula e libera as páginas 3 a 10.**

Cada página deve carregar um selo de estado: `Editável`, `Recalculada`, `Pendente de decisão`, `Pronta para revisão` ou `Autorizada para exportação`. Clicar em um número leva à premissa e à fórmula de origem; clicar em uma premissa mostra as páginas impactadas.

## Navegação de reunião

O apresentador pode percorrer o documento em ordem, usar miniaturas laterais ou pular por capítulos. Ao mudar uma alavanca em modo de reunião, o TGR mostra uma faixa de impacto antes de atualizar a página: **“Você alterou X; as páginas 3, 4, 6, 7, 9 e 10 serão recalculadas.”** A versão oficial não muda até uma decisão ser registrada.

## Critério de fidelidade

Fidelidade significa preservar a **lógica do PDF** — sequência, demonstrativos, premissas, cenários e conclusão — e não imitar a diagramação antiga como se fosse Bíblia em máquina de escrever. O sistema deve ser mais legível, mais rápido e auditável; a exportação assume a forma de estudo formal quando necessário.
