# TGR — Catálogo de Variáveis de Decisão

## Princípio

O TGR não pede “o número correto” de uma operação que ainda não existe. Ele oferece as variáveis que o comitê precisa decidir, identifica as que estão abertas e mede o efeito de cada decisão. Campo sem decisão continua `PENDENTE`; cenário não é chute escondido.

| Bloco de decisão    | Variáveis abertas                                                                         | O TGR calcula a partir delas                  |
| ------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Produto e estoque   | Unidades, cotas/unidade, estoque comercializável, preço, cortesia, permuta.               | Estoque, VGV, preço médio e fim de vendas.    |
| Condição comercial  | Entrada, parcelas, prazo, juros, correção, balões, meio de pagamento.                     | Receita por coorte, recebimento e carteira.   |
| Captação e venda    | Captadores, qualificados por captador, conversão, corretores, fechadores, metas e início. | Funil, contratos, venda mensal e capacidade.  |
| Comissão e parceiro | Comissão por papel, gatilho, repasse e base de incidência.                                | Comissão mensal, custo por venda e margem.    |
| Pessoas e sala      | Headcount por função, fixo, encargos, benefícios, produtividade, ramp-up e duração.       | Folha, capacidade e break-even operacional.   |
| OPEX e CAPEX        | Sala, mídia, TI, frota, jurídico, pré-operacional, implantação e prazo de desembolso.     | Custos mensais, investimento e vale de caixa. |
| Carteira e risco    | Recebimento, cancelamento, inadimplência, recuperação e desconto.                         | Receita líquida, caixa, VPL, TIR e Payback.   |

## Três estados de cada variável

| Estado     | Uso                                       | Regra                                                               |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `PENDENTE` | A decisão ainda não foi tomada.           | Pode aparecer na página, mas bloqueia o demonstrativo dependente.   |
| `PROPOSTA` | A reunião está experimentando a alavanca. | Roda em cópia; não muda versão oficial.                             |
| `DECIDIDA` | Há responsável e fonte.                   | Alimenta a versão de trabalho, gera snapshot e fica no audit trail. |

## Pergunta que cada campo deve responder

Todo campo da Ficha-Mãe deve ter uma pergunta humana, não rótulo burocrático. Exemplos: **“Quantos captadores o projeto aguenta pagar?”**, **“Quanto cada captador precisa colocar de qualificados para se pagar?”**, **“Qual entrada protege o caixa antes das parcelas?”** e **“Em que mês a sala deixa de existir?”**.
