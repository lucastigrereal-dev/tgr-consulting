# TGR Consulting

O **TGR — Estudo de Viabilidade Financeira Vivo** é uma ferramenta para montar um projeto a partir das decisões de abertura e transformar essas premissas em tabelas, demonstrativos, fluxo de caixa, indicadores, insights e uma apresentação viva. A Montagem, os capítulos, os cenários e a exportação leem o mesmo snapshot; não são planilhas brigando entre si no escuro.

## Como operar

| Etapa         | Ação                                                                                            | Proteção aplicada                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Montar     | Abra **Montagem do Projeto**, defina produto, início, investimento e as alavancas já decididas. | A ficha persiste origem e deixa lacunas como `PENDENTE`.                 |
| 2. Calcular   | Salve as premissas e execute o horizonte escolhido, entre 1 e 120 meses.                        | Aritmética decimal, fórmulas versionadas e snapshot com hash.            |
| 3. Apresentar | Abra o **Estudo Vivo** para revisar KPIs, demonstrativo mensal, impacto e conclusão.            | Cada número remonta à fórmula, às dependências e à versão.               |
| 4. Simular    | Em reunião, altere a quantidade de captadores na cópia matemática.                              | A cópia não grava nem altera o estudo defendido.                         |
| 5. Comparar   | Crie branches no capítulo de decisão.                                                           | Baseline e versões imutáveis não recebem edição direta.                  |
| 6. Aprovar    | Um administrador aprova o snapshot e pode congelar a baseline.                                  | Aprovação refere-se ao snapshot e hash específicos.                      |
| 7. Exportar   | Gere PDF/PPTX após aprovação.                                                                   | Exportação é bloqueada fora de snapshot válido, autoritativo e aprovado. |

## Desenvolvimento local

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm audit --prod --audit-level=high
```

## Documentação técnica

Os documentos de descoberta, ADR, PRD, blueprint, plano de waves, UI review e QA estão em [`docs/igr-spec/`](./docs/igr-spec/README.md). A reorientação do produto e o espelho do estudo-base estão nos arquivos `11_TGR_STUDY_MAPPING.md` a `16_TGR_PDF_DEMONSTRATIVE_MATRIX.md`.

## Limites vigentes

O core financeiro cobre as alavancas publicadas de captação, conversão, ticket, recebimento, perdas, custos, folha, CAPEX, VPL, TIR, payback e caixa. As linhas detalhadas de coorte, entrada/parcelas, cronograma de CAPEX, comissão por rubrica e DRE expandida do PDF aguardam suas fórmulas canônicas versionadas; o TGR não preenche essas linhas com valores fictícios.
