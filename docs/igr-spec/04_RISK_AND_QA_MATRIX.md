# Matriz de Risco e Qualidade — IGR Consulting

## Riscos principais

| Risco                                      | Impacto                                  | Controle de prevenção                                                    | Teste de detecção                                                     |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Erro de ponto flutuante                    | Financeiro e reputacional                | `decimal.js`, entradas como texto, política de arredondamento versionada | Testes com casos de centavos, soma acumulada e repetição de execução. |
| Fórmula divergente entre tela e exportação | Decisão baseada em número inconsistente  | Cálculo autoritativo em módulo compartilhado; exportação pelo snapshot   | Snapshot hash igual em Builder, Boardroom e exportação.               |
| Baseline mutável                           | Auditoria comprometida                   | Estado de baseline com guarda de domínio e append-only                   | Tentativa de edição direta deve falhar.                               |
| Valor inventado para campo pendente        | Viabilidade falsa                        | Tipo `PendingInput`; validação e visualização explícitas                 | Fixture com pendência deve manter o estado após salvar/calcular.      |
| Vazamento entre projetos/tenants           | Exposição de informação                  | Escopo obrigatório por tenant no router e consultas                      | Testes negativos para leitura, update e exportação cruzados.          |
| Licença incompatível                       | Risco jurídico e de distribuição         | Registro de dependências e validação antes de instalar                   | Revisão de lockfile e ADR de terceiros.                               |
| Exportação não autorizada                  | Documento financeiro inválido            | Validador de snapshot antes da geração                                   | Solicitação com status inválido retorna erro de domínio.              |
| Regressão de fórmula                       | Decisões inconsistentes depois de update | Golden datasets Pipa e versão de fórmula                                 | Diferença não autorizada quebra CI.                                   |
| Custo/tempo excessivo em automações        | Produto lento ou instável                | Sem workers pesados no V1; processamento síncrono limitado               | Teste de 120 meses com orçamento de tempo definido.                   |

## Suíte de qualidade

| Camada      | Estratégia                | Exemplo                                                                            |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------- |
| Unidade     | Vitest para funções puras | NPV, IRR, Payback, arredondamento e validação de mês.                              |
| Propriedade | Invariantes gerados       | Total de custos não pode ser negativo sem input negativo permitido.                |
| Regressão   | Golden dataset Pipa       | Mesmo input/fórmula gera output hash esperado.                                     |
| Integração  | tRPC + persistência       | Criar versão, gerar snapshot, aprovar e bloquear mutação de baseline.              |
| Segurança   | Autorização negativa      | Tenant A não lê nem exporta snapshot do tenant B.                                  |
| E2E         | Playwright                | Planejador preenche Builder, comitê analisa e exportação só libera após aprovação. |
| Visual      | Captura de telas          | Boardroom tem contraste, hierarquia e leitura de tabela em desktop/mobile.         |

## Definição de pronto

Uma wave somente está pronta quando os testes previstos passam, os requisitos pendentes são exibidos sem maquiagem, o changelog registra decisões, os itens de `todo.md` estão atualizados e a função entregue tem caminho de erro explícito. Captura visual não substitui teste de fórmula; um gráfico bonito com caixa errado é só golpe de powerpoint.
