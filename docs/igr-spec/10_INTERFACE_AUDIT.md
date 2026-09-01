# Auditoria de Interfaces — Iteração de Evolução

## Leitura visual inicial

| Área | Achado | Prioridade |
|---|---|---|
| Identidade | O estilo Private Banking está coerente, mas a marca ainda aparece como texto simples e muitos blocos usam o mesmo card escuro genérico. | Média |
| Builder | A densidade e repetição de campos fazem a página parecer uma coluna longa de formulários; faltam navegação por domínio, progresso e divisórias mais editoriais. | Alta |
| Estados vazios | Boardroom, Custos, Decisões, Cenários e Governança explicam bem o vazio, mas não apresentam uma jornada única e encadeada para iniciar o primeiro projeto. | Alta |
| Mobile | Boardroom, Custos, Decisões, Cenários e Governança estão legíveis. O Builder fica excessivamente longo e com microcampos em tela pequena. | Alta |
| Semântica visual | Ouro funciona como ação/atenção e verde-azulado como controle, mas os selos de versão, hash, pendência e aprovação ainda não formam uma gramática visual consistente. | Média |
| Governança | Boa narrativa de controle; falta ligar mais claramente a linha do tempo ao projeto selecionado e à próxima ação permitida. | Média |

## Direção de correção

Priorizar uma jornada de primeiro projeto, um Builder por etapas/dominios com indicador de completude, painéis de estado conectados e uma identidade de registros/versionamento mais visível. Manter o escuro institucional, o dourado para decisão e o verde-azulado para validação; evitar empilhar novos cards só porque a tela está vazia.

## Correções aplicadas e revisão final

| Área | Evolução aplicada | Resultado observado |
|---|---|---|
| Boardroom | Loading, erro recuperável, seletor rotulado, valores em pt-BR, racional de aprovação e acesso explícito ao artefato gerado. | Fluxo de primeiro projeto claro; ações sensíveis permanecem indisponíveis sem snapshot. |
| Builder | Navegação por blocos, domínios recolhíveis, unidade explícita, alerta de rascunho e bloqueio de cálculo com alterações não salvas. | A parte operacional deixou de ser uma parede contínua de formulário. |
| Custos | Decimal BR, taxonomia em português, fonte obrigatória quando informado, rótulos e estados de contexto. | Formulário legível em desktop e mobile, com rastreabilidade mais clara. |
| Decisões | Valor condicionado ao tipo, fonte obrigatória, versão ativa e metadados legíveis. | Decisão financeira não entra como texto solto. |
| Cenários | Goal Seek ligado à versão e aos KPIs reais, campos rotulados e resultados comparáveis formatados. | Saiu do modo demonstração e passou a explicitar variável, bounds e resíduo. |
| Governança | Benchmark estruturado, sem JSON manual, com formatação de KPI e timeline. | A biblioteca histórica está utilizável por negócio sem contaminar o modelo vivo. |
| Mobile | Verificação em 375 px para os seis painéis. | Navegação, formulários e CTAs continuam acessíveis; Builder mantém alta densidade por natureza, mas domínios recolhíveis reduzem a fadiga de rolagem. |

> Observação de performance: o carregamento sob demanda fragmentou os painéis em chunks próprios; o bundle-base ainda concentra dependências do framework e segue acima do alerta padrão, mas a navegação já não despeja cada painel no primeiro carregamento.
