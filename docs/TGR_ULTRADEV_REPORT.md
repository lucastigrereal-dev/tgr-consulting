# TGR Consulting — Relatório Ultradev do Sistema

**Data da auditoria:** 26 de agosto de 2026  
**Produto:** TGR Consulting  
**Natureza:** Estudo de Viabilidade Financeira Vivo  
**Estado observado:** evolução V1 avançada, com fundação financeira, Página 1 Cotia, documento vivo, cenários e governança implementados; algumas extensões de conteúdo e fontes externas continuam deliberadamente abertas.

> **Resumo em uma frase:** o TGR deixou de ser pensado como um dashboard genérico e passou a operar como o próprio PDF de viabilidade: a ficha Cotia é a Página 1, o motor determinístico é a memória de cálculo, e o Estudo Vivo é o desdobramento sequencial que muda conforme as premissas.

## 1. Sumário executivo

O TGR Consulting é uma plataforma interna para montar, simular, auditar e apresentar estudos de viabilidade de operações de multipropriedade. Seu princípio de produto é **decisão primeiro**: o usuário preenche a matriz operacional de Cotia, registra fonte ou responsável, calcula uma versão de trabalho e, somente depois, pode transformar uma hipótese em snapshot autoritativo, aprovação, baseline ou exportação.

A entrega atual já resolve o núcleo difícil do problema. O sistema possui aritmética decimal com `decimal.js`, projeção mensal de até 120 meses, entradas por meio de pagamento com MDR e prazo, pré-investimento distribuível por mês, custos recorrentes, fluxo de caixa, VPL, TIR, Payback, memória de KPI, branches de cenário, simulação não persistente, isolamento por tenant, baseline imutável e exportação condicionada a snapshot válido e aprovado. A Página 1 Cotia também incorporou a máquina de captação/OPC, sala de vendas, sales kit, modelo comercial, pós-venda, OPEX e mix de recebimento.

A experiência pública do produto foi corrigida para que `/` abra diretamente a **Matriz de Montagem da Operação**, enquanto `/study` abre o Estudo Vivo. Isso atende ao requisito central: primeiro a ficha-mãe; depois o documento inteiro. Na revisão visual atual, a raiz apresenta estado `PENDENTE` e não inventa números quando o estudo ainda não foi preenchido. O `/study` apresenta os capítulos e mantém KPIs vazios enquanto não existe snapshot calculado.

### 1.1 Estado por dimensão

| Dimensão             | Estado                   | Evidência                                      | Leitura executiva                                                                 |
| -------------------- | ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Página 1 Cotia       | Implementada             | `CotiaProjectMatrix.tsx`, `cotiaMatrix.ts`     | É a entrada operacional e fonte dos valores preenchidos.                          |
| Motor financeiro     | Implementado             | `shared/financial/engine.ts`, `engine.test.ts` | Decimal, determinístico, até 120 meses.                                           |
| Recebimento líquido  | Implementado             | Tipos, engine, adapter e testes                | MDR e prazo deslocam a liquidação; não há média escondendo método.                |
| Pré-operação         | Implementado             | Cronograma, adapter, engine e testes           | Captação, sala e sales kit podem cair em meses/participações informados.          |
| Máquina OPC          | Implementada             | Catálogo, matriz e testes                      | Funil de abordagem a D90, custo por etapa, VPG e comissão por origem.             |
| Sala e sales kit     | Implementados            | Catálogo e matriz                              | Dependência, fornecedor, cotação, prioridade, lead time e governança.             |
| Modelo comercial     | Implementado             | Métricas por função e adapter                  | Headcount, fixo, comissão, produtividade, capacidade e custo/venda.               |
| Estudo Vivo          | Implementado em expansão | `Boardroom.tsx`, estrutura editorial e testes  | Capítulos sequenciais e trilha de fórmula no snapshot.                            |
| Cenários             | Implementados            | `scenarioBranches`, db e integração            | Branch copia inputs; alterações não contaminam a base.                            |
| Simulação de reunião | Implementada             | `meetingSimulator.ts`, API e testes            | Múltiplas alavancas, inclusive análise isolada/marginal, sem persistência.        |
| Governança           | Implementada             | Schema, db, routers e testes                   | Aprovação, baseline, workflow, auditoria e elegibilidade de exportação.           |
| Exportação           | Implementada com gate    | `generateAuthorizedExportForTenant`            | Requer snapshot autoritativo, válido e aprovado.                                  |
| Fontes Dicotia/Pipa  | Parcial por natureza     | TODO e documentação                            | Pipa é referência histórica opcional; dados Dicotia ainda exigem fonte/validação. |

## 2. Conceito de produto e modelo mental

O sistema não deve ser entendido como um conjunto de telas independentes. O objeto principal é o **estudo de viabilidade vivo**, composto por uma versão de projeto, suas premissas, componentes operacionais, decisões, cálculos, snapshots e capítulos de apresentação.

A cadeia canônica é:

```text
Página 1 Cotia
  → premissas e componentes da montagem
  → validação dos inputs
  → versão de trabalho
  → motor financeiro decimal
  → snapshot com hash e memória de cálculo
  → capítulos do Estudo Vivo
  → branch de cenário ou simulação não persistente
  → aprovação e baseline
  → exportação PDF/PPTX autorizada
```

A distinção mais importante é entre **estado editável** e **estado autoritativo**. A ficha pode estar incompleta; nesse caso, o sistema deve mostrar `PENDENTE`, não converter ausência em zero econômico silencioso. O motor pode retornar `blocked_by_pending_inputs`; somente uma projeção válida gera snapshot autoritativo e memória de KPI.

A documentação-base estabelece a mesma orientação: o usuário deve começar pela montagem/ficha-mãe, as páginas seguintes devem reagir às decisões, e Pipa deve funcionar como importação histórica opcional, não como fonte automática de números para um projeto novo. Ver [Modelo de Documento Vivo](./igr-spec/19_TGR_LIVE_DOCUMENT_MODEL.md), [Cadeia Montagem–Fórmula](./igr-spec/15_TGR_ASSEMBLY_FORMULA_CHAIN.md) e [Página 1 Cotia](./igr-spec/26_TGR_PAGINA_1_MATRIZ_COTIA.md).

## 3. Experiência e interface

### 3.1 Página 1 — Matriz de Montagem da Operação

A Página 1 é uma folha operacional de alta densidade, deliberadamente mais próxima da referência Cotia do que de um dashboard de cartões. Ela contém:

| Bloco                                 | Conteúdo e comportamento                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dados do projeto                      | Nome, praça/cidade, data-base, início da operação e meses de pré-operação.                                                           |
| Produto, estoque e condição comercial | Valor da cota, entrada, parcelas, cotas por apartamento, apartamentos, eficiência, cortesia, cancelamento e vendas/mês.              |
| Produto derivado                      | Valor de parcela, total de cotas, VGV potencial, entrada potencial e meses de operação.                                              |
| Comissão por cota                     | Funções, valor/cota, quantidade e total por função; comissão por cota derivada.                                                      |
| Pós-venda                             | Transporte, refeição, encargos e tempo previsto.                                                                                     |
| Captação inicial                      | Captadores, fixo, produtividade, abordagens, qualificação, comparecimento, incentivo, ativação e mídia.                              |
| Máquina OPC                           | Rua, pontos próprios, atrações, eventos, hotel/in-house, noturno, parceiros, campanhas, digital, indicação e experimental.           |
| Funil por canal                       | Abordagens, pesquisas, qualificados, convites, agendamentos, comparecimentos, tours, vendas, comissão, VPG e D90.                    |
| Pré-investimento                      | Sala de vendas e sales kit sem construção pesada, com nível, quantidade, custo, owner, lead time, dependência, fornecedor e cotação. |
| Sales kit                             | Objetivo, usuário, momento, formato, entrega físico/digital, atualização e aprovação.                                                |
| Modelo comercial                      | Captador, liner/consultor, closer, líder, gerente, diretor e Sales Ops, com capacidade e custo/venda.                                |
| OPEX e sala                           | Recorrência, equipe, utilidades, veículos, impressoras, materiais, marketing/TI e jurídico/contábil.                                 |
| Mix de recebimento                    | Cartão à vista, parcelado, débito, recorrente/cheque e boleto, com percentual, MDR/taxa e prazo.                                     |
| Resumo                                | Pré-investimento, operação recorrente, entrada bruta, taxas e entrada líquida.                                                       |

O componente agora usa `key` semântica em linhas estáticas e fragmentos de canais. A suíte também valida a renderização SSR da unidade real e intercepta `console.error` para impedir regressão de keys. O teste de renderização em `CotiaProjectMatrix.keys.test.tsx` falha se o React emitir warning de `key` ausente ou duplicada. A captura atual da raiz exibe a matriz sem números fabricados e o status `PENDENTE`.

### 3.2 Estudo Vivo — capítulos sequenciais

O Estudo Vivo é acessado por `/study` e apresenta a sequência editorial. Os capítulos incluem Montagem, Premissas, Produto, Vendas, Receita, Custos, Operação, Caixa, Cenários, Indicadores e Conclusão. Produto, Vendas, Custos e Operação foram separados de títulos agregadores que antes deixavam a navegação prometendo mais do que o corpo entregava.

Cada capítulo financeiro pode exibir a trilha `fórmula → versão → expressão/origem`, obtida da memória do snapshot. Premissas e Produto declaram a ficha-mãe como origem quando não existe fórmula financeira própria. Essa distinção é importante: não se deve inventar um KPI para dar aparência técnica à informação cadastral.

Sem estudo selecionado ou sem snapshot válido, o Estudo Vivo mostra estado aguardando cálculo. Os cards de VPL, TIR, Payback e caixa permanecem vazios. Isso é comportamento correto para planejamento com incerteza, não uma falha visual.

### 3.3 Simulação de reunião

O Boardroom possui uma calculadora de reunião que produz uma cópia temporária. As alavancas atuais incluem captadores, ticket, custo fixo, folha, comissão/incentivo e CAPEX. O resultado mostra efeitos combinados e também quebra isolada por alavanca, com custo, ganho, caixa, investimento, VPL, TIR, Payback e break-even.

A simulação não grava a hipótese no estudo oficial. Uma mudança só chega à versão autoritativa por fluxo explícito de atualização/decisão. Isso protege a reunião contra o clássico “eu só mexi aqui para mostrar” que termina alterando a base sem ninguém perceber.

## 4. Arquitetura técnica

### 4.1 Stack efetivamente utilizada

| Camada     | Implementação                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Frontend   | React 19, Vite, TypeScript, Tailwind 4 e componentes shadcn existentes.                                 |
| Layout     | `DashboardLayout` como shell interno, com raiz direcionada à Página 1 e Estudo Vivo em rota secundária. |
| Backend    | Express 4 e tRPC 11.                                                                                    |
| Domínio    | TypeScript puro em `shared/financial`.                                                                  |
| Aritmética | `decimal.js` no motor autoritativo.                                                                     |
| Validação  | Zod no contrato da API e no snapshot de inputs.                                                         |
| Banco      | MySQL/TiDB gerenciado via Drizzle ORM.                                                                  |
| Auth       | Manus OAuth e `protectedProcedure`.                                                                     |
| Storage    | S3 através dos helpers de storage do template para artefatos.                                           |
| Testes     | Vitest, testes de integração de banco/tRPC e renderização React SSR; smoke/visual no ambiente webdev.   |
| Exportação | Builders de PDF/PPTX condicionados à elegibilidade do snapshot.                                         |

A escolha é deliberadamente conservadora. O domínio não depende de React, banco ou serviços externos; o banco inicial é o MySQL/TiDB fornecido pelo ambiente, enquanto o blueprint conceitual mencionava PostgreSQL/RLS. Essa divergência está registrada no ADR e não deve ser escondida: autorização ocorre na API, não há alegação de RLS nativo. Ver [Technical Discovery](./igr-spec/01_TECHNICAL_DISCOVERY.md) e [Architecture Decision Record](./igr-spec/02_ARCHITECTURE_DECISION_RECORD.md).

### 4.2 Estrutura do código

```text
client/src/
  App.tsx                         rotas e composição principal
  components/
    CotiaProjectMatrix.tsx        Página 1 canônica
    ChapterFormulaTrace.tsx       trilha visual de fórmula
    DashboardLayout.tsx            shell e navegação
  lib/
    liveDocumentStructure.ts       índice e capítulos
    chapterFormulaTrace.ts         mapa fórmula → capítulo
    financialPresentation.ts       formatadores/apresentação
  pages/
    Builder.tsx                    montagem e persistência da ficha
    Boardroom.tsx                  Estudo Vivo/apresentação
    Scenarios.tsx                  branches e comparação
    Governance.tsx                 aprovação, baseline e governança
    CostCatalog.tsx                catálogo de custos

shared/financial/
  types.ts                          contratos financeiros
  inputSchema.ts                    schema e chaves de inputs
  engine.ts                         projeção decimal autoritativa
  formulas.ts                       conjunto de fórmulas versionado
  formulaRegistry.ts                registry e lineage
  cotiaMatrix.ts                    cálculo da matriz Cotia
  cotiaInvestmentCatalog.ts         catálogos de sala/kit/canais
  cotiaFinancialAdapter.ts          ponte ficha → motor
  meetingSimulator.ts               cópia de reunião e deltas
  financialPresentation.ts           projeções/apresentação

server/
  db.ts                             persistência e regras de domínio
  routers/igr.ts                    contratos tRPC protegidos
  financial/                        serviços/testes de snapshot e export
  _core/                            OAuth, contexto, storage e infraestrutura

drizzle/schema.ts                   schema MySQL/TiDB

docs/igr-spec/                      corpus de produto e decisões
```

## 5. Motor financeiro e regras matemáticas

### 5.1 Determinismo

A execução autoritativa é determinada pelo conjunto de fórmulas, inputs, horizonte e versão do engine. O contrato de arquitetura define a identidade conceitual como:

```text
formula_set_version + input_snapshot_hash + horizon_months + engine_version
```

Valores monetários e taxas atravessam a fronteira autoritativa como strings decimais. O motor usa `Decimal` para evitar erro de ponto flutuante, e os resultados são serializáveis para persistência e comparação.

### 5.2 Estado dos inputs

Cada input possui `status` `provided` ou `pending`, valor opcional, origem e referência. A normalização de versões legadas em `getInputsForVersion` recria chaves ausentes como `pending`, com `sourceType` de decisão corrente. Dessa forma, um snapshot antigo não quebra quando o contrato recebe novas chaves — e a ausência não vira número imaginário.

### 5.3 Fluxo mensal

O motor calcula uma série mensal com horizonte de 1 a 120 meses. O modelo atual separa:

1. **Pré-investimento/implantação:** desembolso anterior ou distribuído nos meses de pré-operação, incluindo frentes de captação, sala e sales kit quando calendarizadas.
2. **Operação recorrente:** folha, sala, OPEX, captação recorrente, pós-venda e demais custos mensais.
3. **Venda e entrada bruta:** vendas e valor de entrada gerados conforme premissas preenchidas e funil.
4. **Taxas/MDR:** desconto por meio de pagamento.
5. **Liquidação:** deslocamento da entrada líquida pelo prazo do método.
6. **Caixa:** combinação do que foi liquidado com implantação, recorrência e demais custos.
7. **Indicadores:** VPL, TIR, Payback e caixa acumulado, quando calculáveis.

O mix de recebimento não é apenas uma média visual. Cada método possui participação, taxa/MDR e prazo. A entrada gerada por uma venda é alocada ao método e só aparece no mês de liquidação após desconto da taxa. O adapter da ficha transporta essas premissas para o snapshot; o teste do engine cobre a mudança de caixa quando prazo e MDR variam.

### 5.4 Cronograma por rubrica

O contrato de implantação permite que captação, sala e sales kit informem mês e participação. Quando a agenda está incompleta, o sistema mantém a distribuição uniforme pelo período de pré-operação assumido, em vez de preencher a parte ausente com uma data arbitrária. O cronograma atravessa criação de branch, cálculo do snapshot, fluxo de caixa e visualização no Estudo Vivo.

### 5.5 Funil OPC

Para cada canal, a matriz separa volume e qualidade. A cadeia calculada é:

```text
abordagens
  → pesquisas
  → qualificados
  → convites
  → agendamentos
  → comparecimentos
  → tours
  → vendas
  → contratos ativos D90
```

Os percentuais são inputs do projeto. Os resultados, custos por etapa, comissão mensal, custo por venda e VPG são consequências calculadas. Quando um canal não possui dados, permanece vazio/pendente; não recebe sazonalidade inventada.

## 6. Modelo de dados e persistência

O schema contém **15 conjuntos de tabelas/entidades operacionais** relevantes, com índices de tenant, projeto, versão, snapshot e workflow. As entidades principais são:

| Entidade                                              | Papel                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `users`                                               | identidade Manus e papel `user/admin`.                          |
| `projects`                                            | projeto por tenant e estado de ciclo de vida.                   |
| `formula_set_versions`                                | conjunto semântico de fórmulas e engine version.                |
| `formula_definition_provenance`                       | expressão, dependências, descrição e fonte da fórmula.          |
| `project_versions`                                    | versão working, scenario, approval ou baseline; hash de inputs. |
| `input_values`                                        | premissa por versão, status, origem e referência.               |
| `project_component_records`                           | blocos da ficha Cotia e payloads operacionais.                  |
| `historical_benchmarks`                               | referência interna/histórica isolada do projeto corrente.       |
| `decision_records`                                    | escolha, racional, responsável e fonte.                         |
| `cost_catalog_items`                                  | catálogo de custos por frequência e categoria.                  |
| `calculation_snapshots`                               | resultado calculado, hash, status de validade e autoridade.     |
| `kpi_memory_records`                                  | KPI, valor, fórmula, versão, dependências e explicação.         |
| `scenario_branches`                                   | relação entre base e branch de cenário.                         |
| `approval_decisions`                                  | aprovação/rejeição de snapshot.                                 |
| `workflow_events`, `export_artifacts`, `audit_events` | ciclo de estado, artefatos e trilha de auditoria.               |

### 6.1 Hashes e versões

Na criação, a versão recebe `inputHash` derivado das premissas. O cálculo gera `snapshotHash`, que é armazenado com o payload e usado para identificar a execução. O snapshot também fixa `formulaSetVersionId` e horizonte. A alteração de inputs ocorre por função de persistência específica e registra auditoria; baseline recebe `isImmutable=true`.

### 6.2 Reidratação legada

O banco não exige que versões antigas tenham as novas chaves. `getInputsForVersion` combina as linhas salvas com `FINANCIAL_INPUT_KEYS` e cria ausência como `pending`. Esse detalhe é fundamental para evolução de contrato sem quebrar estudos históricos.

### 6.3 Branches

A criação de cenário copia o contexto da versão-base e produz uma nova versão de tipo `scenario`, com parent/base identificável. A integração testada demonstra que o cronograma pode ser alterado no branch e que o CAPEX mensal muda sem alterar a base.

## 7. API, autorização e governança

A API TGR fica em `server/routers/igr.ts` e usa `protectedProcedure` em todos os procedimentos de domínio. Os principais contratos são:

| Procedure                                          | Responsabilidade                                       |
| -------------------------------------------------- | ------------------------------------------------------ |
| `projects`, `project`, `projectContext`            | lista, identidade e contexto do estudo.                |
| `scenarioComparison`, `versionInputs`, `decisions` | leitura de versões, branches e decisões.               |
| `createDecision`, `updateInputs`                   | registro de decisões e alteração de premissas.         |
| `builderComponents`, `upsertBuilderComponent`      | blocos da ficha Cotia.                                 |
| `costCatalog`, `createCostCatalogItem`             | catálogo de custo.                                     |
| `createProject`, `calculate`                       | criação da versão e snapshot.                          |
| `simulateCaptadores`                               | cópia não persistente de alavancas e análise marginal. |
| `createScenario`                                   | branch de cenário persistente.                         |
| `approveSnapshot`, `freezeBaseline`                | aprovação administrativa e baseline.                   |
| `capitalEnvelope`, `goalSeek`                      | análises condicionadas a inputs válidos.               |
| `exportEligibility`, `requestExport`               | gate e geração de PDF/PPTX.                            |
| `lineage`                                          | leitura de proveniência de fórmulas.                   |

O tenant atual é derivado do usuário autenticado e é usado nas consultas/alterações de projeto, versão, decisões, snapshots, branches e exportações. Os testes de autorização cobrem leitura cruzada e fluxo de banco. O desenho não promete RLS PostgreSQL; o controle aplicado é de camada de aplicação, respaldado por testes negativos.

A aprovação exige snapshot autoritativo e `validationStatus=valid`. O congelamento de baseline exige aprovação, altera versão para `baseline`, marca imutabilidade e cria benchmark interno derivado do snapshot. Exportação exige snapshot autoritativo, válido e aprovado; caso contrário, falha antes de gerar artefato. Artefatos usam storage S3 e guardam referência no banco.

## 8. Testes e evidências de execução

Na validação mais recente, após corrigir o mock SSR do wouter, foram observados:

```text
pnpm check                         verde
pnpm test                          27 arquivos / 60 testes verdes
pnpm build                         verde
Boardroom.test.tsx                 renderiza página completa
CotiaProjectMatrix.keys.test.tsx   renderiza Matriz real sem warning de key
rotas visuais                      / e /study capturadas
```

A suíte cobre autenticação/logout, integração de banco, exportação, elegibilidade, autorização, adversarial, catálogo de custos, matriz Cotia, adapter financeiro, engine, registry, Goal Seek, impact map, meeting simulator, seed Natal, economics de operação, regressão Pipa, versionamento, apresentação financeira, estrutura de documento, trilha de fórmula, componente visual, Matriz Cotia e Boardroom integral. O registry atual é o conjunto publicado `1.3.0`, com fórmulas explícitas para cronograma/implantação, custo mensal da estrutura comercial e liquidação líquida por condição de pagamento.

A captura visual mais recente mostrou:

- `/`: Matriz Cotia diretamente na primeira tela, com `PENDENTE` para premissas não preenchidas.
- `/study`: Estudo Vivo com índice de capítulos, estado determinístico e KPIs bloqueados/aguardando cálculo quando não há snapshot.
- Desktop: layout institucional escuro, amarelo Cotia, tabelas densas com scroll horizontal onde necessário.
- Mobile: revisão anterior confirmou que a matriz larga mantém rolagem horizontal e não comprime o texto até virar bula.

A evidência do console atual não apresentou warning novo após a correção do fragmento de canais e das linhas estáticas. Os registros anteriores a 18:50 foram preservados no log e devem ser tratados como histórico; o final do log mostrou apenas conexão Vite e React DevTools. O build continua emitindo aviso não bloqueante de chunk acima de 500 kB: o bundle principal observado foi aproximadamente 725,77 kB bruto e 212,05 kB gzip.

## 9. Segurança, integridade e riscos

### 9.1 Controles fortes já existentes

| Risco                      | Controle atual                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| Ponto flutuante            | Decimal, strings decimais e testes de centavos.                                 |
| Fórmula divergente         | Motor compartilhado, snapshot, registry e memória de KPI.                       |
| Baseline mutável           | Estado imutável, workflow e testes de tentativa de mutação.                     |
| Input inventado            | `pending`, valores opcionais e bloqueio de cálculo quando necessário.           |
| Vazamento entre tenants    | Escopo por tenant no banco/API e testes negativos.                              |
| Exportação indevida        | Elegibilidade antes de aprovação/geração.                                       |
| Regressão de fórmula       | Formula set versionado e regressão Pipa separada.                               |
| Custo recorrente duplicado | Adapter dedicado e teste contra dupla contagem de comissão.                     |
| Calendário inconsistente   | Contrato de participação/mês, fallback uniforme documentado e testes de branch. |

### 9.2 Riscos e débitos técnicos atuais

| Prioridade | Risco/débito                                                                                              | Impacto                                                                           | Recomendação                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Alta       | Dicotia ainda não está validada como fonte primária no repositório atual.                                 | Não permite gerar estudo Dicotia confiável.                                       | Receber/confirmar material, catalogar cada número, unidade, período e fonte.                             |
| Alta       | O fluxo de campos editáveis posteriores ainda é mais completo na Página 1 do que nos capítulos seguintes. | Algumas alterações posteriores dependem de voltar à ficha ou branch.              | Manter Página 1 como autoridade e só criar edições posteriores quando houver regra clara.                |
| Alta       | O modelo de dados usa autorização de aplicação, não RLS PostgreSQL.                                       | Maior dependência de testes e disciplina de API.                                  | Adicionar revisão de autorização a cada procedure; considerar migração PostgreSQL somente com caso real. |
| Média      | Bundle principal acima de 500 kB.                                                                         | Custo de carregamento, sobretudo em redes móveis.                                 | Code splitting por rota; não tratar como bloqueador funcional.                                           |
| Média      | Exportação PDF/PPTX depende de snapshot válido/aprovado e de runtime/storage.                             | Fluxo real ainda exige dados e aprovação.                                         | Exercitar com estudo real autorizado em ambiente de aceite.                                              |
| Média      | Conteúdo de sales kit é governado como investimento, mas catálogo editorial completo ainda pode crescer.  | Menor profundidade de operação/atualização de peças.                              | Evoluir apenas após uso real em sala; evitar burocracia antecipada.                                      |
| Média      | Funil OPC depende de percentuais e volumes preenchidos pelo projeto.                                      | Sem dados, não há previsão operacional calculável.                                | Preservar pendência; não preencher benchmark sem fonte.                                                  |
| Baixa      | Teste integral do Boardroom usa mocks mínimos de tRPC/auth.                                               | Prova renderização e cadeia de dados, mas não substitui E2E autenticado completo. | Manter smoke Playwright autenticado para fluxo de aceite.                                                |
| Baixa      | Aviso de Baseline Browser Mapping desatualizado.                                                          | Ruído de build, sem erro de runtime observado.                                    | Atualizar dependência em janela de manutenção.                                                           |

## 10. Maturidade técnica

| Área                   | Nível atual | Justificativa                                                                              |
| ---------------------- | ----------: | ------------------------------------------------------------------------------------------ |
| Modelo de domínio      |         4/5 | Vocabulário consistente e adapter separado; ainda há evolução de conteúdo.                 |
| Matemática financeira  |         4/5 | Decimal, determinismo, cronograma, recebimento e memória; precisa ampliar casos reais.     |
| Proveniência           |         4/5 | Registry, hashes, lineage e trilha visual; cobertura E2E real ainda limitada.              |
| Persistência           |         4/5 | Versionamento, snapshot, workflow, baseline e tenant; sem RLS nativo.                      |
| UX da Página 1         |         4/5 | Fiel ao modelo Cotia e validada visualmente; densidade é intencional e exige dados reais.  |
| Estudo Vivo            |       3,5/5 | Sequência e capítulos existem; alguns conteúdos ainda são sintéticos/aguardam estudo real. |
| Cenários               |         4/5 | Branch, simulação e deltas isolados; mais alavancas podem ser conectadas conforme uso.     |
| Exportação             |         3/5 | Gate e builders existem; aceite com estudo preenchido precisa ser exercitado.              |
| Segurança              |       3,5/5 | Tenant enforcement e testes de autorização; aplicação ainda depende da camada API.         |
| Observabilidade        |         3/5 | Logs de dev e auditoria de domínio existem; falta telemetria operacional mais rica.        |
| Conteúdo/fonte externa |         2/5 | Pipa é histórico opcional; Dicotia aguarda validação e fonte primária.                     |

## 11. Roadmap recomendado

### Prioridade 1 — aceite com um projeto real

Preencher a Matriz Cotia com um novo projeto, confirmar fonte/responsável de cada premissa, calcular snapshot, abrir o `/study`, revisar capítulos, abrir um branch, comparar uma alavanca e testar o gate de aprovação/exportação. Esse é o teste que transforma uma plataforma tecnicamente sólida em ferramenta comercial realmente útil.

### Prioridade 2 — fechar Dicotia sem contaminar o modelo

Catalogar o material Dicotia como fonte primária, derivada ou pendente. Cada número deve carregar unidade, período, origem e relação com o campo Cotia correspondente. Números de Pipa não devem ser copiados para preencher Dicotia. Se faltar dado, o sistema deve continuar mostrando `PENDENTE`.

### Prioridade 3 — exportação com conteúdo real

Exercitar PDF e PPTX a partir de snapshot válido e aprovado. Verificar se as páginas exportadas respeitam a sequência editorial, os valores do snapshot, a memória de cálculo, o hash e a condição de aprovação. O estado vivo da tela jamais deve ser fonte direta do arquivo.

### Prioridade 4 — melhorar desempenho sem redesenhar o produto

Fazer code splitting por rota e reduzir o carregamento inicial do Boardroom/Builder. O bundle de 725,77 kB bruto é um débito de performance, não uma justificativa para adicionar infraestrutura complexa. Primeiro dividir rotas; depois medir.

### Prioridade 5 — instrumentar uso de decisão

Após uso real, medir quais alavancas são mais alteradas, quais campos permanecem pendentes, quais cenários são criados e onde a reunião abandona o fluxo. Só então decidir se vale adicionar mais automação, integração externa ou um catálogo editorial mais profundo.

## 12. Operação recomendada

### Para montar um estudo

1. Abrir `/` e preencher a Matriz Cotia.
2. Informar fonte ou responsável; deixar desconhecidos como `PENDENTE`.
3. Registrar a Página 1 e criar a versão de trabalho.
4. Conferir os valores autoritativos gerados pelo adapter.
5. Calcular o snapshot com horizonte escolhido.
6. Abrir `/study` e revisar cada capítulo.
7. Usar simulação para testar hipóteses sem persistência.
8. Criar branch quando a hipótese precisar ser comparada ou preservada.
9. Registrar decisão com racional, responsável e fonte.
10. Enviar snapshot válido para aprovação; congelar baseline somente após aprovação.
11. Exportar apenas depois de o gate liberar PDF/PPTX.

### Para uma reunião

A ordem recomendada é: mostrar a Página 1, selecionar uma decisão, abrir o efeito no capítulo afetado, simular a variação em cópia, apresentar delta de caixa/VPL/TIR/Payback, registrar a decisão e somente então recalcular a versão oficial. A simulação não substitui decisão registrada.

## 13. Inventário documental

O repositório contém o corpus `docs/igr-spec/` com discovery técnico, ADR, PRD, matriz de risco/QA, blueprint, waves, auditoria de interface, regressão Pipa, release do estudo vivo, modelo de produto, montagem, cadeia de fórmulas, experiência documental, catálogo de variáveis, diagnóstico de planejamento, ideias, perguntas, Página 1 Cotia, implantação e contratos financeiros.

Documentos especialmente relevantes:

- [01 — Technical Discovery](./igr-spec/01_TECHNICAL_DISCOVERY.md)
- [02 — Architecture Decision Record](./igr-spec/02_ARCHITECTURE_DECISION_RECORD.md)
- [04 — Risk and QA Matrix](./igr-spec/04_RISK_AND_QA_MATRIX.md)
- [15 — Assembly Formula Chain](./igr-spec/15_TGR_ASSEMBLY_FORMULA_CHAIN.md)
- [19 — Live Document Model](./igr-spec/19_TGR_LIVE_DOCUMENT_MODEL.md)
- [20 — Investment Lever Contract](./igr-spec/20_TGR_INVESTMENT_LEVER_CONTRACT.md)
- [26 — Página 1 Matriz Cotia](./igr-spec/26_TGR_PAGINA_1_MATRIZ_COTIA.md)
- [28 — Implantation Investment Model](./igr-spec/28_TGR_IMPLANTATION_INVESTMENT_MODEL.md)

## 14. Veredito técnico

O TGR Consulting já possui uma fundação suficientemente séria para ser usado como **calculadora e documento de decisão**, desde que o primeiro aceite seja feito com um projeto real e números fornecidos pelo usuário. A arquitetura evita os maiores riscos: cálculo duplicado entre tela e exportação, ponto flutuante, baseline mutável, hipótese silenciosa e exportação de estudo não validado.

A principal recomendação não é construir mais quinze módulos. É usar a porra que já existe com um projeto preenchido, observar onde a reunião trava e fechar somente as lacunas que impedem a decisão. O próximo salto de valor não está em outro painel; está em provar o ciclo completo com dados reais: **montar → calcular → simular → decidir → aprovar → exportar**.

> **Conclusão:** o sistema está em estágio de V1 avançada, tecnicamente validado no núcleo e pronto para um teste controlado com projeto real. Não está correto afirmar que toda a operação de conteúdo externo, exportação com estudo preenchido ou todas as páginas editáveis posteriores foram validadas em produção. Essas são as fronteiras honestas do próximo ciclo.

## 15. Inventário dos artefatos históricos externos

Os artefatos de origem foram conferidos no diretório de uploads da sessão. Eles servem para entendimento de produto, referência visual, modelo histórico ou instrução de implantação; nenhum número histórico deve preencher automaticamente um projeto novo sem validação do usuário.

| Artefato                                                    | Tipo / evidência                                           | Papel no TGR                                                                         | Status de uso                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `01_Estudo_Viabilidade_Financeira_Maritim_Pipa_2020(1).pdf` | PDF A4, 39 páginas, aproximadamente 1,24 MB                | Referência histórica da operação Marítim/Pipa e do desdobramento do estudo completo. | Auditado como estrutura histórica; não é fonte automática de números atuais.                    |
| `01_Estudo_Viabilidade_Financeira_Maritim_Pipa_2020(2).pdf` | Cópia com mesmo tamanho observado, aproximadamente 1,24 MB | Duplicata operacional do PDF histórico.                                              | Mantida como cópia; não tratar como segundo estudo independente.                                |
| `05_Cotia_Imagem_Original_Referencia.webp`                  | Imagem WebP, aproximadamente 184 KB                        | Referência visual e estrutural da ficha/matriz Cotia.                                | Usada para orientar a Página 1; números novos continuam dependentes de preenchimento/validação. |
| `pasted_content.txt`                                        | Texto de direcionamento de produto                         | Mudança de foco: descobrir o melhor sistema antes de construir.                      | Fonte de intenção, não de dado financeiro.                                                      |
| `pasted_content_2.txt`                                      | Blueprint funcional simplificado                           | Cadeia PREENCHER → CALCULAR → SIMULAR → AJUSTAR → APROVAR → APRESENTAR → EXPORTAR.   | Fonte conceitual do produto.                                                                    |
| `pasted_content_3.txt`                                      | Descrição ampla do sistema                                 | Constituição funcional: Cotia como matriz e Pipa como profundidade operacional.      | Fonte de requisitos; não alimentar números automaticamente.                                     |
| `pasted_content_4.txt`                                      | Modelo de squad/implantação, aproximadamente 10 KB         | Doze frentes de implantação comercial, donos, fases e investimento.                  | Fonte do catálogo de implantação/captação; custos permanecem a cotar ou informar.               |
| `IGR_Consulting_20_SKILLS_CATALOGO.md`                      | Catálogo de habilidades, aproximadamente 4,4 KB            | Repertório de capacidades reutilizáveis do ecossistema.                              | Documento de apoio; não é premissa financeira.                                                  |
| `IGR_Consulting_Manus_Master_Pack_v2.zip`                   | Pacote compactado de contexto                              | Materiais de produto e operação da rodada inicial.                                   | Arquivo de apoio; não é consumido pelo motor.                                                   |
| `IGR_Consulting_20_MANUS_SKILLS.zip`                        | Pacote compactado de habilidades                           | Habilidades reutilizáveis relacionadas ao projeto.                                   | Arquivo de apoio; não é fonte de premissas.                                                     |

**Limitação documental:** o inventário confirma a presença e os metadados dos arquivos históricos na sessão, mas não transforma o PDF Pipa ou a imagem Cotia em um dataset estruturado. A ingestão de números Dicotia continua pendente e deve exigir classificação de fonte, unidade, período, responsável e aprovação.

## Referências internas

As referências abaixo apontam para artefatos versionados no próprio repositório e devem ser lidas junto com o código atual:

1. [Schema Drizzle](../drizzle/schema.ts)
2. [Persistência e governança](../server/db.ts)
3. [Router TGR](../server/routers/igr.ts)
4. [Motor financeiro](../shared/financial/engine.ts)
5. [Tipos financeiros](../shared/financial/types.ts)
6. [Schema de inputs](../shared/financial/inputSchema.ts)
7. [Fórmulas e registry](../shared/financial/formulas.ts)
8. [Matriz Cotia](../shared/financial/cotiaMatrix.ts)
9. [Adapter financeiro](../shared/financial/cotiaFinancialAdapter.ts)
10. [Simulador de reunião](../shared/financial/meetingSimulator.ts)
11. [Teste integral do Boardroom](../client/src/pages/Boardroom.test.tsx)
12. [Teste de keys da Matriz](../client/src/components/CotiaProjectMatrix.keys.test.tsx)
13. [Matriz de risco e QA](./igr-spec/04_RISK_AND_QA_MATRIX.md)
