# Auditoria de Divergência — Página 1 Atual vs. Matriz Cotia

## Veredito

A Montagem atual **não é a Página 1 Cotia**. Ela é uma ficha genérica de projeto com alguns campos financeiros mapeados. A fundação técnica é aproveitável — projeto, versão, fonte, pendência, snapshot e cálculo continuam certos — mas a experiência de abertura está errada para o uso que Lucas descreveu.

> O primeiro painel não deve pedir “o que talvez seja importante”. Ele deve apresentar, na ordem da folha Cotia, tudo o que o planejador precisa decidir para a operação nascer.

## O que permanece

| Elemento atual                              | Decisão                                         |
| ------------------------------------------- | ----------------------------------------------- |
| Projeto, versão de trabalho e audit trail   | Preservar.                                      |
| Status `PENDENTE` e exigência de fonte      | Preservar.                                      |
| Criação de snapshot, baseline e exportação  | Preservar; ficam depois da Página 1.            |
| Normalização decimal e cálculo autoritativo | Preservar.                                      |
| Componentes detalhados persistidos          | Reaproveitar como destino dos blocos da matriz. |

## O que sai da Página 1

| Elemento atual                                                                    | Motivo                                                                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Navegação por grupos financeiros genéricos no topo                                | Fragmenta a folha e obriga Lucas a adivinhar onde cada decisão mora.                      |
| Campos “Casais qualificados”, “Ticket médio”, “Folha”, “CAPEX” isolados da matriz | São derivadas ou linhas da Cotia; não podem aparecer como checklist paralelo.             |
| Oito cartões de domínios como continuação imediata da abertura                    | Viram páginas posteriores ou seções expansíveis da mesma matriz, não um corredor de abas. |
| Regra de “salve o estudo acima primeiro” antes de registrar a folha               | Inverte a operação: a própria folha precisa criar o estudo.                               |

## O que entra no lugar

| Faixa da página     | Origem                                                                                 | Comportamento                                            |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Cabeçalho           | Nome do projeto, praça, data-base, início e horizonte                                  | Editável; cria a versão de trabalho.                     |
| Produto e condição  | Cota, entrada, parcelas, cotas/apto, apartamentos, eficiência, cortesia e cancelamento | Campos editáveis e totais derivados ao lado.             |
| Carteira e comissão | Adimplência, cargos, valores por cota, quantidade e total                              | Grade editável; comissão/cota derivada.                  |
| Pós-venda e sala    | Consultores, capacidade, salários, benefícios, funções e tempo                         | Grade editável; custo mensal e período derivados.        |
| Custos operacionais | Utilidades, carros, impressoras, materiais, marketing e jurídico                       | Linhas editáveis; total mensal/período derivado.         |
| Meios de pagamento  | Mix, taxas, prazos e perdas de entrada                                                 | Campos editáveis; entrada líquida derivada.              |
| Rodapé              | Custo mensal + comissão e pendências                                                   | Leitura imediata do que alimentará as páginas seguintes. |

## Critério de aceite da correção

O usuário deve bater o olho e reconhecer a folha Cotia sem precisar de explicação. A diferença aceitável é apenas de ergonomia: campos editáveis, fórmulas travadas, pendências sinalizadas, ajuda contextual e atualização automática. A diferença inaceitável é mudar a ordem de raciocínio ou trocar uma linha operacional por card de dashboard.
