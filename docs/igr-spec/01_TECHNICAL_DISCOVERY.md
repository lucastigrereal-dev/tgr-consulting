# Technical Discovery Pack — IGR Consulting

## Conclusão executiva

O IGR deve começar com um **núcleo único em TypeScript**, isolando cálculo determinístico da UI e evitando a sedução de montar uma feira de tecnologias. A plataforma já entrega React, Vite, Express, tRPC, autenticação e banco MySQL/TiDB. O blueprint canônico pede PostgreSQL; essa divergência será tratada no ADR, sem maquiagem.

O motor financeiro será **Build**, apoiado por biblioteca decimal permissiva. Não será delegado a um motor de planilha de licença incompatível ou a um serviço externo. Isto preserva a fórmula proprietária, permite memória de cálculo por KPI e simplifica a reprodutibilidade.

## Evidências técnicas relevantes

| Tecnologia   | Evidência verificada                                                                                                         | Decisão                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `decimal.js` | Tipo decimal de precisão arbitrária, sem dependências, MIT; recomenda strings para evitar perda de precisão de `number`. [1] | **Reuse** para aritmética; **Build** para regras de domínio.                                      |
| Zod 4        | Validação TypeScript-first, conversão para JSON Schema, licença MIT e suporte a Node/browser. [2]                            | **Reuse** para contratos de entrada e APIs.                                                       |
| HyperFormula | Motor headless com ~400 funções, porém licenciado GPLv3 ou proprietário. [3] [4]                                             | **Não adotar** no V1 sem aquisição jurídica/comercial explícita.                                  |
| Univer       | SDK de planilha isomórfico, core Apache-2.0; recursos Pro e limites do OSS precisam ser distinguidos. [5] [6]                | **Avaliar em PoC Wave 4**, não bloquear o motor V1.                                               |
| React Flow   | Biblioteca MIT para interfaces de nós e dependências. [7]                                                                    | **Reuse** posteriormente para grafo de proveniência.                                              |
| PptxGenJS    | Gera PPTX em JavaScript/TypeScript, suporta texto, tabelas, gráficos e masters; licença MIT. [8] [9]                         | **Reuse** em Wave 5 para PPTX de snapshot.                                                        |
| Vitest       | Framework de testes sobre Vite; o scaffold já o contém. [10]                                                                 | **Reuse** para unidade, integração e regressão.                                                   |
| Playwright   | Runner E2E com isolamento, paralelismo e suporte a Chromium, Firefox e WebKit. [11]                                          | **Reuse** na suíte E2E; não usar como runtime de PDF em produção sem validação de infraestrutura. |
| Temporal     | Workflow durável baseado em replay determinístico de histórico; chamadas externas devem viver em Activities. [12]            | **Postergar**; não é necessário no caminho síncrono do cálculo V1.                                |

## Recomendação de stack V1

| Camada               | Escolha                                                              | Motivo                                                                                            |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Interface            | React 19 + Vite + Tailwind 4 + shadcn já presentes no scaffold       | Mantém a experiência interna consistente, com UI responsiva e componentes auditáveis.             |
| API                  | Express + tRPC 11 já presentes                                       | Contratos ponta a ponta, autenticação integrada e menor duplicação.                               |
| Domínio              | TypeScript puro em `shared/financial`                                | Sem dependência de UI ou banco; testável por dados dourados.                                      |
| Aritmética           | `decimal.js`                                                         | Cálculo decimal explícito, imutável e permissivo. [1]                                             |
| Validação            | Zod 4                                                                | Valida inputs externos antes de entrarem no motor e pode expor schemas. [2]                       |
| Persistência inicial | MySQL/TiDB do ambiente, com versões e snapshots explícitos           | Permite avanço sem conta externa; possui limitação documentada frente ao PostgreSQL do blueprint. |
| Proveniência         | Tabelas de registro + JSON de evidência + hashes de snapshot         | A rastreabilidade precisa estar no domínio, não depender só do banco.                             |
| Exportação           | PPTX via PptxGenJS; PDF via gerador Node seguro ainda a ser validado | Exportação usa snapshot congelado e autorizado, nunca estado vivo da tela.                        |
| Testes               | Vitest, fixtures douradas e depois Playwright                        | Cobre cálculo, autorização, invariantes e fluxo visual.                                           |

## O que foi conscientemente descartado do V1

Não entram Azure Digital Twins, HyperFormula sem licença proprietária, branches de banco Neon, Temporal no fluxo de cálculo, Cube, Pyomo, Redis ou múltiplos runtimes. Cada um pode ser útil em escala, mas introduziria custo, fronteira operacional ou lock-in sem resolver um requisito indispensável da primeira entrega.

> “Determinístico” no IGR significa que uma execução é definida por `formula_set_version + input_snapshot_hash + horizon_months + engine_version`. Data do relógio, números aleatórios, API externa e estado de UI não são entradas autorizadas do cálculo.

## Referências

[1]: https://github.com/MikeMcl/decimal.js "decimal.js — repositório oficial"
[2]: https://zod.dev/ "Zod 4 — documentação oficial"
[3]: https://hyperformula.handsontable.com/docs/guide/licensing.html "HyperFormula — licensing"
[4]: https://github.com/handsontable/hyperformula "HyperFormula — repositório oficial"
[5]: https://github.com/dream-num/univer "Univer — repositório oficial"
[6]: https://github.com/dream-num/univer/blob/dev/LICENSE "Univer — Apache License 2.0"
[7]: https://github.com/xyflow/xyflow "React Flow / xyflow — repositório oficial"
[8]: https://gitbrent.github.io/PptxGenJS/ "PptxGenJS — documentação oficial"
[9]: https://gitbrent.github.io/PptxGenJS/license/ "PptxGenJS — licença MIT"
[10]: https://vitest.dev/guide/ "Vitest — guia oficial"
[11]: https://playwright.dev/docs/intro "Playwright — documentação oficial"
[12]: https://docs.temporal.io/workflows "Temporal — workflows e determinismo"
