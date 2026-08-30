# Project TODO

- [x] Documentar a arquitetura-alvo, as escolhas Build/Buy/Reuse e as restrições do ambiente gerenciado.
- [x] Criar `/docs/igr-spec/` com fontes, decisões, estudo, matriz de risco, PRD, blueprint e plano de waves.
- [x] Definir os contratos do domínio financeiro com inputs pendentes explícitos e sem valores inventados.
- [x] Modelar a persistência de projetos, versões, fórmulas, premissas, snapshots, proveniência, cenários, aprovações e exportações.
- [x] Implementar o motor determinístico para projeções mensais de até 120 meses usando aritmética decimal.
- [x] Implementar cálculos de receitas, custos, caixa, VPL, TIR, Payback e memória de cálculo por KPI.
- [x] Implementar formula registry versionado, grafo de dependências e explicação de valores calculados.
- [x] Implementar Builder para produto, estoque, preço, captação, custos, equipe, comissões, pagamentos, carteira, perdas, parceiros e CAPEX/OPEX.
- [x] Implementar catálogo de custos e workforce economics com ramp-up, turnover, produtividade e custo de movimentação de pessoas.
- [x] Implementar planejamento de captação e capacidade comercial com canais, casais qualificados, sala, recepção, consultores, closers e sazonalidade.
- [x] Implementar baseline imutável, branches de cenário, comparação, histórico de decisões e ciclo Rascunho/Em Análise/Aprovado/Baseline.
- [x] Implementar Goal Seek e Capital Envelope com limites, variáveis alteradas, resultado, erro residual e trilha de auditoria.
- [x] Implementar Boardroom Private Banking conectado ao mesmo modelo de dados do Builder, com drill-down executivo e auditoria.
- [x] Implementar exportação PDF/PPTX bloqueada para snapshots não autoritativos ou não validados.
- [x] Implementar biblioteca histórica comparativa opcional, isolada dos inputs vigentes do projeto.
- [x] Criar seed Natal com premissas pendentes preservadas, sem fabricar precisão financeira.
- [x] Preparar runner Pipa para importação histórica opcional com inputs, outputs esperados, tolerâncias, formula set e cenários de regressão.
- [x] Criar um fluxo explícito de decisão que transforma escolha, racional, fonte e responsável em premissas auditáveis do projeto.
- [x] Fazer a primeira baseline aprovada produzir uma referência interna para comparação e regressão contínua.
- [x] Reclassificar Pipa como importação histórica opcional, sem bloquear a criação ou aprovação de projetos decididos no IGR.
- [x] Criar testes unitários, invariantes, propriedades, autorização, baseline e bloqueio de exportação; manter a regressão Pipa em gate separado.
- [x] Executar testes de segurança, performance e auditoria adversarial; corrigir todos os achados reproduzíveis.
- [x] Verificar visualmente o Builder e Boardroom em desktop e mobile, garantindo legibilidade e acessibilidade.
- [x] Atualizar README, changelog, instruções operacionais, relatório de QA e documentação de decisões.
- [x] Preparar checkpoint de entrega V1 após revisar este TODO e registrar os gates externos ainda pendentes.
- [x] Extrair e empacotar a habilidade reutilizável de plataforma financeira decisória.
- [x] Validar a habilidade com o validador oficial e entregar o pacote instalável.
- [x] Inventariar todas as rotas, telas, componentes, routers, tabelas e fluxos de dados do IGR.
- [x] Auditar painéis e interfaces para responsividade, acessibilidade, consistência visual, estados vazios, carregamento e erros.
- [x] Auditar persistência, esquema, índices, integridade de versões, proveniência e isolamento de tenant.
- [x] Corrigir e evoluir os painéis, fluxos decisórios, formulários e visualizações prioritárias.
- [x] Ampliar testes de API, banco, autorização, regressão financeira e experiência responsiva.
- [x] Executar validação final de tipos, suíte, build, auditoria de dependências e revisão visual multitelas.
- [x] Adicionar testes de integração com banco para criação, atualização, aprovação, baseline, benchmark interno e bloqueio de exportação.
- [x] Adicionar testes de contrato tRPC com persistência para proveniência, imutabilidade e isolamento de tenant.
- [x] Adicionar smoke tests automatizados de navegação e responsividade para os seis painéis em desktop e mobile.
- [x] Adicionar integração tRPC + banco real para criação, atualização, decisão, custo, aprovação, baseline e isolamento de tenant.
- [x] Adicionar smoke autenticado em desktop e mobile para conteúdo real, navegação e ausência de overflow dos seis painéis.
- [x] Mapear o PDF e o blueprint em capítulos, premissas, fórmulas, demonstrativos e conclusões do TGR.
- [x] Definir os níveis Rápido, Profissional e Completo do Estudo de Viabilidade Financeira Vivo.
- [x] Concluir a reorganização dos painéis TGR como capítulos explícitos do estudo vivo, além da renomeação já feita.
- [x] Implementar propagação visível ponta a ponta: premissa → cálculo → demonstrativo → alerta → conclusão → exportação.
- [x] Criar um navegador de capítulos do estudo que agrupe Produto, Comercial, Operação, Financeiro e Decisão sem proliferar telas soltas.
- [x] Criar um painel de impacto que mostre deltas de KPIs, alertas e capítulos afetados após cada novo snapshot.
- [x] Adicionar testes de UI e contrato que comprovem a navegação por capítulo e a propagação do impacto até a elegibilidade de exportação.
- [x] Renderizar o Boardroom com estudo/snapshot calculado e testar a trilha de fórmula/origem em todos os capítulos editoriais relevantes.
- [x] Mapear as decisões de abertura do projeto do PDF em uma Ficha de Montagem TGR.
- [x] Criar a Montagem do Projeto como primeira tela e fonte única de premissas estruturais.
- [x] Conectar investimento inicial, estrutura de equipe, captação, preço, custos e cronograma às fórmulas do estudo vivo.
- [x] Criar uma Apresentação Viva que mostre tabelas, demonstrativos e insights recalculados durante a reunião.
- [x] Criar um modo de simulação de reunião para alterar alavancas como equipe e captação e explicar o efeito no estudo.
- [x] Implementar a primeira simulação controlada: variação de captadores altera captação e folha em cópia, compara KPIs e não persiste sem decisão explícita.
- [x] Exibir no Boardroom o demonstrativo mensal vivo de vendas, receita, custos e caixa que responde às premissas da Montagem.
- [x] Fazer a Ficha de Montagem espelhar suas decisões financeiras diretamente nos inputs autoritativos e usar o horizonte escolhido no cálculo.
- [x] Fazer a Montagem criar o estudo e a versão de trabalho diretamente, eliminando o fluxo paralelo de inputs genéricos.
- [x] Versionar explicitamente no formula registry as fórmulas de estrutura de equipe e condição de pagamento; manter preço coberto pelas fórmulas canônicas `gross-sales` e `gross-entry-generated`, sem duplicação.
- [x] Expandir a simulação de reunião para múltiplas alavancas, com comparação explicada e cobertura automatizada.
- [x] Auditar os uploads disponíveis e classificar a fonte Dicotia/Cotia como pendente quando não houver material numérico primário identificável.
- [x] Verificar e registrar que não há números Dicotia confirmados nos uploads auditados; preservar as lacunas como `PENDENTE`.
- [x] Registrar que o primeiro estudo vivo Dicotia não deve ser gerado antes da chegada de fonte numérica confirmada; nenhum número de Pipa foi reutilizado.
- [x] Classificar a imagem Cotia como referência visual/estrutural; valores, unidades e fórmulas ficam dependentes do preenchimento validado da Página 1.
- [x] Explicar o modelo Cotia/Pipa e formular 20 perguntas decisórias antes de alimentar estudo ativo.
- [x] Comparar a ficha Cotia com o PDF Pipa completo e especificar os desdobramentos automáticos implementados no TGR.
- [x] Completar a cadeia Ficha-Mãe → Produto → Receita → Custos → Caixa → Indicadores → Apresentação, incluindo capítulo de Produto e prova integrada ponta a ponta.
- [x] Consolidar o fluxo principal do TGR como documento vivo sequencial, mantendo painéis paralelos apenas como contexto secundário.
- [x] Transformar a Página 1 Cotia em campos editáveis que recalculam as tabelas e conclusões das páginas seguintes; as demais páginas iniciais permanecem editoriais até haver regra de edição definida.
- [x] Separar e cobrir os capítulos do documento vivo: Premissas, Produto, Vendas, Receita, Custos, Caixa, Cenários, Indicadores e Conclusão.
- [x] Modelar alavancas de investimento por função, começando por captadores, com custo, capacidade incremental, vendas, caixa e retorno explicados.
- [x] Exibir em cada alavanca o custo marginal, ganho marginal, ponto de equilíbrio e impacto em VPL, TIR e Payback.
- [x] Organizar a Ficha-Mãe por variáveis de decisão abertas: headcount, fixo, comissão, produtividade, preço, pagamento, CAPEX, OPEX e prazos.
- [x] Criar cenários de operação sem dados inventados, preservando cada variável não decidida como pendente até a reunião definir.
- [x] Consolidar o material oficial do TGR Consulting, o PDF Pipa, Cotia, o blueprint e a implementação existente em diagnóstico único.
- [x] Ler e incorporar explicitamente o blueprint/corpus canônico do TGR no diagnóstico de planejamento.
- [x] Inspecionar e resumir explicitamente Builder, Boardroom, motor, routers e persistência no diagnóstico único.
- [x] Elaborar 30 ideias de evolução priorizadas para o sistema de planejamento de multipropriedade.
- [x] Formular 20 perguntas de refinamento e aguardar resposta antes de qualquer nova implementação.
- [x] Mapear linha a linha a matriz Cotia em campos editáveis, fórmulas derivadas, totais e premissas pendentes da Página 1.
- [x] Comparar a Montagem atual com a matriz Cotia e remover todo campo ou fluxo que não pertença ao primeiro painel canônico.
- [x] Normalizar todos os totais de linha da Página 1 com parser decimal brasileiro compartilhado e testes de vírgula/ponto.
- [x] Mover o seletor e os controles auxiliares de estudo para contexto secundário, deixando a Página 1 fiel somente à matriz Cotia.
- [x] Remover ou realocar todo header, explicação e aviso de governança fora da folha Cotia, deixando o Builder abrir diretamente na matriz.
- [x] Criar e validar um contexto secundário para abrir estudos existentes e controles de gestão sem poluir a Página 1.
- [x] Classificar as 12 frentes de implantação em investimento inicial, custo recorrente, custo variável e capacidade operacional gerada.
- [x] Criar uma matriz de investimento de captação com headcount, fixo, comissão, produtividade, canais, custo por casal, custo por NT e custo por venda.
- [x] Discriminar canais de captação em linhas separadas com ativação, recorrência, qualificação, comparecimento e conversão próprios.
- [x] Calcular comissão/incentivo e custo por venda de forma explícita na matriz de captação.
- [x] Cobrir cenários multicanal, comissão e custo por venda com testes automatizados.
- [x] Separar na Página 1 o pré-investimento de implantação, a operação recorrente e o recebimento líquido por meio de pagamento.
- [x] Exibir comparecimento por canal como métrica calculada e testada, distinta de show rate informado.
- [x] Exibir comissão/incentivo mensal por canal separada do recorrente e do custo por venda, com teste automatizado.
- [x] Modelar a Máquina de Captação/OPC por canal, etapa de funil, qualidade, VPG por origem e contratos ativos D90.
- [x] Modelar o investimento de Sala de Vendas e Sales Kit por item, nível de prioridade, quantidade, owner, lead time, dependência, fornecedor e custo a cotar.
- [x] Exibir e testar prioridade e lead time por peça do Sales Kit, alinhando a governança ao checklist de investimento.
- [x] Modelar o Modelo Comercial por função, headcount, fixo, comissão, produtividade e custo de venda.
- [x] Corrigir e testar o adaptador da Página 1 para que comissão comercial e custos de canal não sejam duplicados entre custo fixo e variável.
- [x] Conectar explicitamente as alavancas de cronograma de captação, sala e sales kit aos branches/comparações de cenário e cobrir a propagação até caixa no Boardroom.
- [x] Distribuir o pré-investimento pelos meses de pré-operação no motor financeiro autoritativo.
- [x] Liquidar entradas no motor por forma de pagamento, MDR e prazo de cada método, sem média inventada.
- [x] Exibir no Estudo Vivo o demonstrativo mensal de implantação, entrada bruta, taxas, entrada líquida e fluxo de caixa.

- [x] Produzir relatório ultradev detalhado do TGR Consulting com inventário de arquitetura, fluxos, motor financeiro, banco, governança, testes, riscos, pendências e roadmap.
- [x] Revisar o relatório contra evidências atuais do código e entregar o dossiê em Markdown ao usuário.

### Itens encontrados durante a auditoria do relatório
- [x] Verificar se o teste do Boardroom integral permanece verde após o último ajuste de renderização.
- [x] Confirmar build, rotas, logs atuais e checkpoint mais recente como evidências do estado técnico.
- [x] Distinguir claramente funcionalidades implementadas, parciais, pendentes e não validadas.

### Registro operacional
- [x] Manter o teste integral de rastreabilidade do Boardroom acompanhado até ser estabilizado ou explicitamente classificado como débito técnico.
- [x] Não mascarar no relatório a diferença entre teste do componente, teste do helper e integração real da página.
- [x] Avaliar o impacto do aviso de bundle acima de 500 kB sem transformar otimização opcional em bloqueio fictício.

### Auditoria documental
- [x] Inventariar os documentos de especificação TGR, o modelo de implantação e os artefatos históricos Pipa/Cotia.
- [x] Mapear arquitetura frontend, backend, persistência, contratos tRPC e motor financeiro.
- [x] Descrever fluxo de dados da ficha Cotia até snapshot, cenários, Boardroom e exportação.
- [x] Avaliar segurança, isolamento de tenant, versionamento, baseline, aprovação e elegibilidade de exportação.
- [x] Quantificar cobertura de testes e registrar comandos/evidências de validação.
- [x] Produzir matriz de maturidade, riscos, débitos técnicos, recomendações e roadmap priorizado.
- [x] Revisar, salvar e entregar o relatório ultradev final em Markdown.

- [x] Corrigir warning React de `key` ausente nas linhas de tabela do `CotiaProjectMatrix` e validar no console.

- [x] Reabrir `/` e `/study` após a última correção de `key`, limpar/verificar logs atuais e comprovar ausência do warning React de `unique "key" prop` no `CotiaProjectMatrix`.
- [x] Adicionar teste de renderização do `CotiaProjectMatrix` que falhe em `console.error` com warning de `key` duplicada/ausente, para evitar regressão.

### Nova rodada: validação real e performance
- [x] Implementar code splitting por rota com carregamento sob demanda e fallback de navegação.
- [x] Validar redução do bundle inicial de aproximadamente 725 kB para 638 kB e ausência de regressão nas rotas `/` e `/study`.
- [ ] Executar ciclo real da Página 1: preencher projeto, persistir montagem, calcular snapshot, simular alavancas e registrar decisão.
- [ ] Solicitar e validar os dados reais faltantes antes de calcular um estudo não pendente.
- [ ] Testar a cadeia real até VPL, TIR, Payback, fluxo de caixa e exportação elegível.
- [x] Reabrir `/` e `/study` após o code splitting e validar visualmente o carregamento lazy, fallback e ausência de erro de navegação.
- [ ] Adicionar ou executar smoke test cobrindo `/` e `/study` após o carregamento sob demanda.

### Auditoria GitHub
- [ ] Verificar remoto GitHub, branch atual, último commit e estado de alterações locais do TGR.
- [ ] Comparar o histórico local com o remoto e confirmar se há autenticação/credencial utilizável.
- [ ] Registrar se o checkpoint TGR está publicado no GitHub ou apenas salvo no ambiente Manus.

### Alternativa de sincronização GitHub
- [ ] Auditar exportação do checkpoint e preparar pacote do projeto sem `.git`, segredos ou artefatos temporários.
- [ ] Preparar instruções executáveis para publicar o pacote via GitHub web ou Git local no Windows.
- [ ] Não publicar nem enviar conteúdo ao GitHub sem confirmação explícita do usuário.
