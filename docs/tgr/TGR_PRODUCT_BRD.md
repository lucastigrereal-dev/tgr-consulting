# TGR Consulting — Product BRD

## Definição

TGR Consulting transforma um estudo de viabilidade em um modelo vivo, versionado e apresentável. O produto canônico é este repositório; TGR CRM e Oi Natal não fazem parte do escopo.

## Fluxo de valor

1. **Builder:** registra montagem, produto/estoque, condição comercial, captação, sala, workforce, treinamento, comissão, custos, pagamentos e política de carteira com status e proveniência.
2. **Motor:** reconcilia estoque e condição, limita vendas por pontos/sala/workforce, projeta pagamentos, coortes, recebíveis, cancelamento, inadimplência, cura, perdas, caixa e capital.
3. **Scenario Lab:** cria branch isolada, compara snapshots, executa Goal Seek V1 e Capital Envelope e aplica somente solução convergida a uma branch auditável.
4. **Boardroom:** apresenta 16 capítulos em shell próprio 16:9, navegação por teclado, presenter/fullscreen, riscos, decisões e estados vazios honestos.
5. **Governança:** submete, aprova e congela baseline imutável, vinculando decisão ao hash e ao formula set do snapshot.
6. **Investor Export Pack:** deriva PDF, PPTX e XLSX do snapshot aprovado, sem recalcular ou inventar dados.

## Contratos de produto

- Código, migrations e testes têm autoridade sobre documentos históricos.
- Ausência material é `PENDING`; zero é um valor informado, não um placeholder.
- Todo número oficial remonta a input, fonte/responsável, fórmula, versão, snapshot e hash.
- Baseline é imutável; mudanças posteriores exigem cenário/versão.
- Export só é autorizado para snapshot válido e aprovado.
- Goal Seek responde `converged`, `unreachable`, `iteration_limit`, `unsupported` ou `infeasible`; apenas `converged` pode ser aplicado.

## Critério de entrega local

Typecheck, build, testes unitários/componentes/domínio, integração MySQL, migração legada, restore drill e E2E autenticado master devem passar no mesmo source. OAuth, storage, deploy e backup gerenciado permanecem gates externos quando dependem de credenciais ou ambiente autorizado.
