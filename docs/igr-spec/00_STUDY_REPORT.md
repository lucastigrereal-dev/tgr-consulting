# Study Report — IGR Consulting

## Tese do produto

O **IGR Consulting** é um _Operation Planning System_ para operações de multipropriedade. Ele não é CRM, dashboard solto, planilha maquiada ou apresentação. O Builder cria e governa um modelo operacional; o Boardroom lê exatamente o mesmo modelo, explica os números, compara decisões e só permite exportação a partir de um snapshot autoritativo validado.

O produto deve priorizar a primeira vertical — multipropriedade — antes de qualquer tentativa de generalização. A superfície deve ser sóbria, com linguagem de **Private Banking / Investment Committee**: foco em decisão, risco, capital e execução, não em “dashboard carnaval”.

## Escopo funcional V1

| Bloco                 | Responsabilidade                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Motor financeiro      | Projetar até 120 meses e calcular receitas, custos, caixa, VPL, TIR e Payback de modo determinístico.                                |
| Registro de fórmula   | Versionar regras, inputs, dependências, resultado, fontes e memória de cálculo.                                                      |
| Builder               | Estruturar produto/estoque, preço, captação, custos, pessoas, comissões, recebimentos, carteira, perdas, parceiros e CAPEX/OPEX.     |
| Cenários e governança | Preservar baseline imutável, suportar branches comparáveis, manter decisões e controlar Rascunho → Em Análise → Aprovado → Baseline. |
| Reverse planning      | Operar Goal Seek e Capital Envelope com variáveis, limites, resultado e erro residual explícitos.                                    |
| Boardroom             | Exibir o mesmo modelo do Builder em narrativa executiva, drill-down de auditoria e comparação entre cenários.                        |
| Exportação            | Gerar PDF/PPTX somente de snapshot autoritativo, validado e vinculado à versão de fórmula.                                           |
| Qualidade             | Cobrir invariantes, regressão Pipa, seed Natal, segurança, performance e auditoria adversarial.                                      |

## Não objetivos V1

O V1 não deve incluir IA funcional dentro do produto, Real x Planejado, edição de fórmulas por usuário normal, importação automática de histórico como premissa vigente ou substituição silenciosa de inputs atuais por benchmarks históricos. Dados históricos ficam em biblioteca comparativa opcional e sempre carregam a própria origem.

## Invariantes inegociáveis

| Invariante        | Regra de aplicação                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Determinismo      | Mesmo conjunto de fórmula, versão, inputs e horizonte produz o mesmo snapshot serializado.                                   |
| Precisão          | Dinheiro e taxas não usam `number` JavaScript para cálculo autoritativo; entram como strings decimais e usam camada decimal. |
| Pendente honesto  | Campo ainda não definido mantém `PENDENTE`, bloqueio ou status de incompletude; nunca recebe número imaginado.               |
| Baseline          | Após congelado, não pode ser mutado. Toda alteração relevante cria nova versão ou branch.                                    |
| Proveniência      | Cada input, fórmula, KPI e exportação aponta para origem, versão e responsável.                                              |
| Modelo único      | Builder, cálculo, Boardroom, cenários e exportação consultam o mesmo snapshot de domínio.                                    |
| Exportação segura | PDF/PPTX só é liberado quando o snapshot está autorizado, validado e reproduzível.                                           |
| Fórmula protegida | Usuário normal edita premissas permitidas; administrador técnico governa o registro de fórmulas.                             |

## Fontes donor e uso permitido

| Fonte                         | Uso no IGR                                                            | Limite                                                      |
| ----------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Marítimo/Pipa                 | Profundidade da viabilidade, fluxo de caixa, indicadores e regressão. | Não copiar valores antigos para o projeto corrente.         |
| Cotia                         | Referência de cockpit e snapshot operacional.                         | Não assumir que sua estrutura resolve todos os módulos.     |
| Encantos                      | Anatomia comercial, comissões, custos e início da operação.           | Converter em parâmetros, não em regra rígida universal.     |
| Abertura de Custos Fixos      | Taxonomia OPEX e anti-esquecimento.                                   | Catálogo não deve preencher valores automaticamente.        |
| Paraíso/VGV/vendas/pagamentos | Carteira, recebimentos, inadimplência e cancelamento.                 | Tratar como benchmark e evidência, não input vigente.       |
| AirVista Company-in-a-Box     | Operating model, processos e departamentos.                           | Não usar marca antiga na interface final.                   |
| Entrevista de 100 perguntas   | Conhecimento tácito de operação e implantação.                        | Transformar em checklist, não em dado financeiro inventado. |

## Pendências preservadas

Os números exatos para Natal e os valores financeiros não fechados permanecem pendentes na modelagem. A seed Natal deve servir para validação de fluxos e estados do produto, não para apresentar uma viabilidade financeira falsa. O dataset Pipa deverá ser versionado somente a partir da transcrição e validação de fontes reais do pacote donor.
