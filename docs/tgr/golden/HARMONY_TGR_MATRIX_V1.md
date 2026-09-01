# Matriz HARMONY × TGR — Natal Golden V1

Fonte: `COTAS_NATAL_HARMONY_GOLDEN_V1_RULES.json`  
Modo reconciliado: `HARMONY_COMPAT_V1`  
Modo preservado: `TGR_CANONICAL_V2`

## Reconciliação Harmony — 144 meses

Os valores obtidos abaixo são arredondados na mesma precisão publicada pela fonte.

| Cenário | Preço | Indicador | Harmony esperado | HARMONY_COMPAT obtido | Delta publicado |
| --- | ---: | --- | ---: | ---: | ---: |
| C1 | R$ 28.000 | Capital necessário | R$ 1.791.990 | R$ 1.791.990 | 0 |
| C1 | R$ 28.000 | VPL 18% a.a. | R$ 21.612.036 | R$ 21.612.036 | 0 |
| C1 | R$ 28.000 | TIR anual | 130,8% | 130,8% | 0 |
| C1 | R$ 28.000 | Payback | 25 meses | 25 meses | 0 |
| C1 | R$ 28.000 | VGV físico | R$ 87.360.000 | R$ 87.360.000 | 0 |
| C2 | R$ 35.000 | Capital necessário | R$ 1.756.526 | R$ 1.756.526 | 0 |
| C2 | R$ 35.000 | VPL 18% a.a. | R$ 30.063.688 | R$ 30.063.688 | 0 |
| C2 | R$ 35.000 | TIR anual | 168,7% | 168,7% | 0 |
| C2 | R$ 35.000 | Payback | 21 meses | 21 meses | 0 |
| C2 | R$ 35.000 | VGV físico | R$ 109.200.000 | R$ 109.200.000 | 0 |
| C3 | R$ 40.000 | Capital necessário | R$ 1.733.413 | R$ 1.733.413 | 0 |
| C3 | R$ 40.000 | VPL 18% a.a. | R$ 36.100.582 | R$ 36.100.582 | 0 |
| C3 | R$ 40.000 | TIR anual | 195,2% | 195,2% | 0 |
| C3 | R$ 40.000 | Payback | 20 meses | 20 meses | 0 |
| C3 | R$ 40.000 | VGV físico | R$ 124.800.000 | R$ 124.800.000 | 0 |

## Contrato metodológico HARMONY × TGR

| Eixo | HARMONY_COMPAT_V1 | TGR_CANONICAL_V2 | Classificação |
| --- | --- | --- | --- |
| Horizonte | 144 meses certificados | 1–120 meses | MODEL_DELTA |
| Sell-out | 44×100 + 57 brutas; 44×70 + 40 líquidas | Política canônica de coortes/estoque | MODEL_DELTA |
| Entrada | R$ 3.200 em 8 parcelas sobre vendas ativas | Calendário comercial autoritativo | MODEL_DELTA |
| Saldo | 84 parcelas; venda M1 começa em M5 | Política de recebíveis autoritativa | MODEL_DELTA |
| Comissão | R$ 1.500 em 8 competências | Ledger parametrizável por política | MODEL_DELTA |
| Pós-venda variável | 0,5497% do contrato em 84 parcelas desde M5 | Cost Catalog/driver configurável | MODEL_DELTA |
| Consumíveis e brinde | R$ 425 por venda ativa no mês | Rubrica configurável | MODEL_DELTA |
| Cartão stress | 16% da entrada no mês da venda | Meios de pagamento/MDR configuráveis | MODEL_DELTA |
| Imposto | 7% dos recebimentos mensais | Política tributária configurável | MODEL_DELTA |
| Custo fixo | R$ 195.339 × curva anual 60/100/100/100/80/60/50/40/30/20/10/10% | Cost Engine canônico | MODEL_DELTA |
| Pré-op | R$ 985.500 em M1 visual e t0 para VPL/TIR | Cronograma CAPEX canônico | MODEL_DELTA |
| Desconto | 18% a.a. convertido para taxa mensal equivalente | Taxa do Formula Set canônico | MODEL_DELTA |

## Matriz de células executável

Para cada cenário, a janela comparável de 120 meses produz 5.048 células/indicadores:

| Cenário | MATCH | MODEL_DELTA | SOURCE_CONFLICT cross-mode | DELTA órfão |
| --- | ---: | ---: | ---: | ---: |
| C1 R$ 28k | 2.583 | 2.465 | 0 | 0 |
| C2 R$ 35k | 2.583 | 2.465 | 0 | 0 |
| C3 R$ 40k | 2.583 | 2.465 | 0 | 0 |

`MODEL_DELTA` significa diferença intencional entre metodologias; não é erro nem tentativa de calibrar um motor pelo outro.

## SC-001

SC-001 permanece como o único `SOURCE_CONFLICT` interno do Golden Harmony:

- cronograma mensal adotado: 4.457 vendas brutas;
- página de indicadores publicada: 4.458;
- teto matemático de `3.120 ÷ 70%`: 4.458;
- regra implementada: preservar 4.457 no cronograma e transportar 4.458 apenas como conflito explícito da linha indicadora.
