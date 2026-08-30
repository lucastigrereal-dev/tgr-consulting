# TGR — Contrato de Montagem e Cadeia de Fórmulas

## Fonte única do estudo

A **Montagem do Projeto** é a origem da versão de trabalho. Ela não gera um PDF estático nem preenche dez telas independentes. Ela produz um `Project Assembly Snapshot` que abastece os inputs protegidos do motor e os blocos operacionais com proveniência.

| Camada               | Exemplos                                                                | Regra                                               |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Decisão declarada    | “Teremos 6 captadores”, “início em março”, “CAPEX de R$ X”.             | Exige fonte, responsável ou ata.                    |
| Premissa estruturada | FTE, capacidade por FTE, preço, entrada, prazo, custo carregado e meta. | Pode ficar pendente; nunca recebe valor automático. |
| Fórmula publicada    | Capacidade de captação, folha, receita, caixa, VPL e TIR.               | Só altera por formula set versionado.               |
| Snapshot             | Timeline mensal, demonstrativos, KPIs, alertas e conclusão.             | Tem hash, versão de input e fórmula.                |
| Apresentação         | Capa, premissas, tabelas, impacto, riscos e decisão.                    | Lê somente snapshot autoritativo/validado.          |

## Fórmulas já autoritativas no TGR

O motor atual já calcula, por mês e por horizonte de até 120 meses:

| Etapa               | Fórmula vigente                                                       |
| ------------------- | --------------------------------------------------------------------- |
| Qualificados        | `qualificados_mês = qualificados_mês_1 × (1 + crescimento)^(mês - 1)` |
| Contratos           | `contratos = qualificados × conversão`                                |
| Venda bruta         | `venda_bruta = contratos × ticket_médio`                              |
| Receita reconhecida | `receita = venda_bruta × recebimento × (1 - cancelamento)`            |
| Custo variável      | `custo_variável = receita × taxa_custo_variável`                      |
| Repasse             | `repasse = receita × taxa_parceiro`                                   |
| Fluxo operacional   | `receita - custo_variável - repasse - custo_fixo - folha - CAPEX`     |
| VPL, TIR e Payback  | Calculados da timeline mensal com aritmética decimal.                 |

## Fórmulas de propagação necessárias para a reunião

Para a frase “tirar dois captadores” deixar de ser conversa e virar resultado de apresentação, o próximo formula set deve derivar as premissas financeiras das decisões operacionais abaixo.

| Decisão de abertura        | Fórmula derivada                                                          | Impacto no estudo                                   |
| -------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| Captadores e produtividade | `capacidade_captação = captadores × casais_por_captador`                  | Qualificados → contratos → venda → receita → caixa. |
| Sala de vendas             | `capacidade_sala = mesas × sessões × dias × casais_por_mesa`              | Limita qualificados utilizáveis e revela gargalo.   |
| Captação disponível        | `qualificados = min(canais, capacidade_captação, capacidade_sala)`        | Evita vender acima da operação possível.            |
| Equipe e custo carregado   | `folha = Σ(FTE × custo_carregado)`                                        | DRE → fluxo de caixa → capital.                     |
| Headcount produtivo        | `FTE_produtivo = FTE_nominal × curva_ramp_up × (1 - turnover)`            | Capacidade → receita e custo de movimentação.       |
| Condição comercial         | `recebimento = função(entrada, parcelas, saldo, carência, inadimplência)` | Carteira e caixa por coorte.                        |
| Investimento               | `CAPEX_mês = cronograma_de_implantação + pré-operação`                    | Caixa, capital e payback.                           |

## Critério de segurança para a evolução

Nenhuma fórmula derivada entra no snapshot autoritativo apenas porque “parece lógica”. Cada uma precisa ter unidade, fonte, regra de arredondamento, versão, teste de fronteira e memória de cálculo. Até isso acontecer, a Montagem registra a escolha e o TGR marca o elo como pendente.
