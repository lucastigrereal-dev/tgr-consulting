# COTAS NATAL — HARMONY GOLDEN V1

## Status
CANONICAL_FROM_HARMONY_MASTER_V1

## Arquivos
- `COTAS_NATAL_HARMONY_GOLDEN_WORKBOOK_V1.xlsx`
- `COTAS_NATAL_HARMONY_GOLDEN_V1.json`

## Certificação
A reconstrução matemática foi validada contra os 48 meses publicados do Harmony para os três cenários:
- Receitas: 0 divergências
- Custos variáveis: 0 divergências
- Fluxo de caixa: 0 divergências

Indicadores publicados reconciliados:
- C1 R$28k: capital R$1.791.990; VPL R$21.612.036; TIR 130,8%; payback 25m.
- C2 R$35k: capital R$1.756.526; VPL R$30.063.688; TIR 168,7%; payback 21m.
- C3 R$40k: capital R$1.733.413; VPL R$36.100.582; TIR 195,2%; payback 20m.

## Regras exatas reconstruídas
1. 144 meses de horizonte.
2. Entrada R$3.200 em 8x, aplicada às vendas líquidas/ativas.
3. Primeiro saldo no quarto mês após a venda: venda M1 -> saldo M5.
4. Saldo em 84 parcelas.
5. Comissão R$1.500/cota distribuída em 8 meses junto à entrada.
6. Pós-venda variável = 0,5497% do valor do contrato, distribuído em 84 parcelas.
7. Consumíveis + brinde = R$425 por venda líquida no mês da venda.
8. Cartão stress = 16% da entrada = R$512 por venda líquida no mês da venda.
9. Imposto provisório = 7% do recebimento mensal.
10. Custo fixo full R$195.339/mês com curva anual 60/100/100/100/80/60/50/40/30/20/10/10%.
11. Pré-op R$985.500 no M1 do fluxo exibido; para VPL/TIR, tratado em t0.
12. Taxa de desconto 18% a.a. convertida para taxa mensal equivalente.

## SOURCE_CONFLICT
- Cronograma mensal: 4.457 vendas brutas (44x100 + 57) e 3.120 líquidas/ativas (44x70 + 40).
- Página de indicadores: 4.458 brutas.
- Matemática `ceil(3120 / 70%)` = 4.458.
- Regra de regressão: preservar 4.457 no cronograma e registrar 4.458 como `SOURCE_CONFLICT`.

## Uso no TGR
Este dataset substitui o fixture TEST_DATA anterior como fonte canônica para `HARMONY_COMPAT_V1`.
Não altera `TGR_CANONICAL_V2`.
