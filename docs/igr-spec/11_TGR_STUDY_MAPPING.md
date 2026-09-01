# TGR — Mapeamento Inicial do Estudo de Viabilidade Vivo

## Tese de produto confirmada

O **TGR** não é um dashboard financeiro genérico. Ele é a transformação do **estudo de viabilidade financeira completo** em um sistema vivo, em que a cadeia operacional é: **preencher → calcular → simular → ajustar → aprovar → apresentar → exportar**. Quando uma premissa muda, o restante do estudo precisa reagir em cascata, preservando memória, versão e impacto.

## Estrutura editorial capturada do PDF-base

Pelas páginas iniciais do estudo **Marítimo Pipa Eco Resort**, a arquitetura do documento canônico é composta por uma capa institucional, um sumário e uma sequência de capítulos que misturam premissas, investimentos, projeções e indicadores por cenário.

| Página | Achado principal | Implicação para o TGR |
|---|---|---|
| 1 | Capa do projeto, data-base e versão do relatório. | O TGR precisa tratar identidade, data-base, versão e autoria como cabeçalho autoritativo do estudo. |
| 2 | Sumário com capítulos lineares e blocos por cenário. | A navegação do produto deve seguir capítulos de estudo, não apenas módulos soltos de sistema. |
| 3 | Apresentação textual explicando contexto, método e objetivo do relatório. | O TGR precisa de uma camada narrativa/executiva do estudo, não só números. |
| 4 | Premissas gerais e investimentos pré-operacionais em tabelas. | Premissas e CAPEX inicial precisam virar blocos estruturados que alimentam todo o resto. |
| 5 | Projeção de vendas mensal por ano, com vendas totais, líquidas, acumuladas e ativas. | O motor deve expor timelines mensais vivas, não apenas KPIs agregados. |

## Estrutura canônica do estudo identificada no sumário

| Bloco do estudo | Papel no relatório vivo |
|---|---|
| Apresentação | Narrativa executiva e contextualização do projeto. |
| Premissas Gerais | Inputs mestres do estudo e diferenças por cenário. |
| Investimentos Pré-Operacionais | CAPEX e gastos de implantação. |
| Projeção de Vendas | Volume, vendas líquidas, acumuladas e ativas ao longo do tempo. |
| Custos Variáveis | Desembolso dependente de venda/operação. |
| Custos Pessoal | Estrutura de pessoas e produtividade. |
| Custos Fixos Gerais | OPEX recorrente da operação. |
| Cenário 1, 2, 3 | Cadeia repetida de receitas, custos, repasses, fluxo de caixa e indicadores. |

O texto extraído integralmente confirma que cada cenário no PDF repete a mesma espinha: **receitas → custos variáveis → repasses de parceiros → fluxo de caixa → indicadores financeiros**. Essa repetição não deve ser recriada por três abas independentes: no TGR, ela deve ser a mesma engine com versões/branches comparáveis.

## Tradução funcional confirmada pelo blueprint simplificado do usuário

O conteúdo do arquivo `pasted_content_2.txt` confirma que o TGR precisa funcionar em **três níveis de profundidade** e em **quatro tipos de informação**.

| Elemento | Definição confirmada |
|---|---|
| Tipos de informação | Preencher, Calculado, Fórmula Protegida e Referência. |
| Nível 1 | Planejamento rápido com cerca de 20–25 inputs e visão preliminar. |
| Nível 2 | Planejamento profissional por blocos detalhados. |
| Nível 3 | Estudo completo até 120 meses, equivalente digital do relatório profundo. |

## Primeiras consequências de produto

O TGR deve ser reorganizado como um **estudo navegável**. Em vez de o usuário “entrar num módulo”, ele deve **montar o estudo capítulo por capítulo**, vendo imediatamente como cada decisão altera tabelas, cronogramas, fluxo de caixa, indicadores e conclusão. Isso muda tanto a arquitetura de navegação quanto a lógica do Boardroom e da exportação.

## Mapa funcional completo extraído do blueprint

O blueprint detalha o estudo como uma cadeia de operação, e não como uma coleção de calculadoras. Os capítulos abaixo precisam existir como blocos estruturados, cada qual com premissas, cálculo protegido, alertas e saídas que alimentam outros capítulos.

| Capítulo vivo do TGR | Principais entradas | Saídas e impactos obrigatórios |
|---|---|---|
| Identidade e horizonte | Projeto, praça, início, moeda, horizonte e status. | Capa, versão, autoria e score de completude. |
| Produto e estoque | UH, cotas, preços, bloqueios, reservas e reajuste. | Cotas totais, disponível, VGV, sell-out e estoque mensal. |
| Condição comercial | Entrada, parcelas, saldo, carência, correção e descontos. | Validação de preço, parcela matemática e recebíveis por coorte. |
| Meta e funil | Vendas, qualificação, show, conversão, dias e ticket. | Casais/tours necessários, VPG e venda potencial. |
| Canais e captação | Investimento, custo, pessoas, volume, show e conversão por canal. | CAC, custo/tour, VPG e contribuição por canal. |
| Sala de vendas | Mesas, turnos, tour, consultores, closers e recepção. | Utilização, gargalo, fila e estrutura necessária. |
| Pessoas | Cargos, custo completo, ramp-up, turnover e produtividade. | Headcount nominal/produtivo, folha e custo de movimento. |
| Investimento e custos | CAPEX, OPEX, custo variável, comissão e parceiros. | Desembolso de implantação, custo mensal e margem. |
| Pagamentos e carteira | Mix, taxas, entrada, parcelamento, inadimplência e cure. | Entrada líquida, recebimento, contratos ativos e carteira. |
| Obra e dívida opcionais | Cronograma, orçamento, taxa, carência e amortização. | Desembolso, serviço da dívida e impacto de caixa. |
| Financeiro | Receita, impostos, custos, repasses e investimentos. | DRE, fluxo mensal, caixa acumulado, capital e break-even. |
| Cenários e decisão | Branch, deltas, autor, data, meta e bounds. | Comparação, Goal Seek, Capital Envelope e decisão defendível. |

## Regra de propagação de impacto

O TGR precisa materializar a regra-mãe descrita pelo usuário: **decisão → impacto operacional → impacto financeiro → impacto no caixa → resultado**. A interface deve mostrar a trilha, e não apenas recalcular silenciosamente.

| Alteração | Impactos mínimos que o TGR deve mostrar |
|---|---|
| Conversão comercial | Tours necessários → captação → headcount → custo → caixa → capital. |
| Meta de vendas | Estoque → funil → sala → equipe → entrada → comissão → caixa. |
| Contratar pessoas | Custo de entrada → ramp-up → capacidade → produção → receita → caixa. |
| Preço/condição | VGV → entrada → carteira → recebimento → TIR/VPL/Payback. |
| Canal | CAC → volume → qualidade → conversão → contribuição → caixa. |

## Telas que devem deixar de ser módulos soltos

O mapa de telas do blueprint confirma que a navegação atual deve convergir para uma sequência de estudo: **Visão Geral → Produto → Comercial → Funil → Captação → Sala → Pessoas → Custos → Pagamentos → Carteira → Financeiro → Cenários → Riscos → Boardroom → Exportar**. A tela mais importante passa a ser o **Project Operating Snapshot**, a fotografia de 30 segundos que responde: “que operação estamos montando?”.

## Controles e saídas obrigatórias

| Controle | Comportamento TGR |
|---|---|
| Planning Completion Score | Exibir completude por capítulo e pendências críticas. |
| Dependency Map | Destacar o que mudou após cada premissa/decisão. |
| Cost X-Ray | Abrir qualquer custo em decomposição, fonte e driver. |
| Memória de cálculo | Todo KPI relevante abre fórmula, inputs, fonte, versão e dependências. |
| Alertas | Sinalizar condição que não fecha, caixa negativo, estoque/sala/equipe insuficientes, custo sem classificação e capital insuficiente. |
| Boardroom | Narrar o estudo em sequência executiva e aceitar simulação controlada em tempo real. |
| Exportação | Congelar a versão aprovada e gerar o estudo, tabelas, riscos, cronograma, memória e anexos a partir dela. |

## Próximas leituras necessárias

Os próximos capítulos do PDF precisam ser mapeados para fechar a cadeia viva do estudo, principalmente:

| Prioridade | Capítulo a extrair | Motivo |
|---|---|---|
| 1 | Custos variáveis, pessoal e fixos | Completar o espelho entre premissas e OPEX real. |
| 2 | Receitas, repasses e fluxo de caixa por cenário | Fechar a propagação de impacto ao longo do estudo. |
| 3 | Indicadores financeiros por cenário | Estruturar a camada final de conclusão executiva e comparativa. |
