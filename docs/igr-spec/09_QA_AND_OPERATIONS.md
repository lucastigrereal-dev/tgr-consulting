# QA, Auditoria Adversarial e Operações

## Resultado de validação

| Categoria | Evidência | Resultado |
|---|---|---|
| Tipos | `pnpm check` | Aprovado. |
| Testes automatizados | 9 arquivos, 20 testes | Aprovado. |
| Build de produção | `pnpm build` | Aprovado. Há um alerta de bundle inicial acima de 500 kB, não bloqueante. |
| Segurança de dependências | `pnpm audit --prod --audit-level=high` | Aprovado; nenhuma vulnerabilidade conhecida. |
| Performance local | 10 projeções de 120 meses abaixo de 2 segundos no ambiente de teste | Aprovado no teste adversarial. |
| Desktop | Boardroom, Builder, Cenários e Governança | Revisado visualmente. |
| Mobile | Boardroom, Builder, Cenários e Governança | Revisado visualmente após correção do fallback de raiz e do cabeçalho. |

## Cobertura por controle

| Controle | Cobertura implementada |
|---|---|
| Precisão | Decimal.js no motor, valores persistidos como texto decimal. |
| Horizonte | Rejeição de horizontes fora de 1–120 meses. |
| Pendente | Qualquer input crítico pendente bloqueia projeção e KPIs autoritativos. |
| Determinismo | Mesmo input e formula set produzem mesma projeção. |
| Proveniência | Snapshot porta hash de input, fórmula e payload; KPI porta memória de cálculo. |
| Baseline | Transição exige aprovação; baseline torna a versão imutável. |
| Goal Seek | Registra bounds, status, iterações e resíduo. |
| Exportação | PDF e PPTX são gerados somente com snapshot elegível e armazenados com metadados. |
| Autorização | Routers IGR são protegidos e escopam dados por tenant lógico. |
| Builder ampliado | Sete componentes versionados preservam payload, fonte e pendência para os domínios comerciais e operacionais. |
| Biblioteca histórica | Benchmarks são armazenados separadamente das premissas vigentes do projeto. |
| Workforce economics | Calcula custo fully loaded, attrition mensal, custo anual de movimentação, ramp-up e capacidade de produtividade com decimal. |
| Capacidade comercial | Calcula canais elegíveis, sazonalidade, capacidade de sala, recepção, consultores, casais aproveitáveis, vendas projetadas e carga por closer. |
| Catálogo de custos | Tela dedicada com taxonomia, fonte, frequência, pendência e consolidação decimal mensal/anual/one-time. |
| Decisão primeiro | Sala de decisões registra escolha, racional, fonte e responsável; decisões financeiras atualizam a versão de trabalho com provenance. |
| Aprendizado interno | Congelamento de baseline cria benchmark interno a partir do snapshot aprovado. |

## Achados e correções da auditoria

| Achado | Correção aplicada |
|---|---|
| Teste de carga mal dimensionado | O teste passou a medir 10 projeções interativas de 120 meses, alinhadas ao caso de uso. |
| Dependência PPTX com vulnerabilidade sem correção | `pptxgenjs` foi removido e substituído por gerador OOXML com `JSZip`. |
| Dependências vulneráveis do template | Pacotes diretos foram atualizados; componentes Streamdown/Recharts não usados foram removidos; auditoria final ficou limpa. |
| Upgrade Express 5 quebrou wildcards herdados | Proxy de storage e fallbacks de SPA foram migrados para wildcard nomeado do Express 5. |
| Boardroom móvel com sobreposição no selo | Selo secundário foi preservado em desktop e ocultado no mobile. |

## Gaps honestos para a próxima wave

> O gate de regressão Pipa continua **BLOQUEADO**, não reprovado: faltam input snapshot canônico, outputs esperados, tolerâncias e formula set de referência. Não se substitui isso por “números exemplo”, porra nenhuma.

| Próxima entrega | Entrada necessária |
|---|---|
| Regressão Pipa | Dataset e tolerâncias aprovados. |
| Seed Natal produtivo | Premissas canônicas com fonte e responsável. |
| Catálogo de custos / workforce detalhado | Taxonomia, funções, ramp-up, turnover, produtividade e regras de movimentação. |
| Capacidade comercial detalhada | Canais, conversões por etapa, sala, recepção, consultores, closers e sazonalidade. |
| Biblioteca histórica | Política de importação, anonimização e mapeamento de métricas. |
