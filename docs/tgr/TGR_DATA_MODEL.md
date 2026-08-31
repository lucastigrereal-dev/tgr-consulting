# TGR Consulting — Data Model

## Identidade, tenancy e projeto

- `users`: identidade autenticada e papel.
- `projects`: raiz tenant-bound do estudo.
- `project_versions`: lifecycle `draft → in_review → approved → baseline`, parentesco, formula set, imutabilidade e `financialRevision` monotônica por branch.
- `input_values`: premissa por versão, status, valor e proveniência.
- `project_component_records`: blocos do Builder com identidade lógica única `(versionId, componentType, name)`.

## Produto e políticas

- `product_skus` e `product_price_phases`: estoque e preço temporal.
- `commercial_conditions`: entrada, saldo, encargos e reconciliação.
- `receivables_policies`: curvas de cancelamento, inadimplência, cura e write-off.
- `cost_catalog_items`: custos tipados por frequência, proveniência e `cashflowTreatment`; somente `incremental` alimenta caixa, enquanto `included_in_project_totals` documenta custo já contido nos agregados.
- `historical_benchmarks`: memória histórica separada do baseline vigente.

## Cálculo e governança

- `formula_set_versions` e `formula_definition_provenance`: registry persistido.
- `calculation_snapshots`: payload determinístico, hashes, estado, autoridade, `asOfMonth` e `createdOrdinal` monotônica.
- `kpi_memory_records`: lineage/materialização de KPIs.
- `scenario_branches`: cópias versionadas para simulação.
- `decision_records`, `approval_decisions`, `workflow_events`: decisão e lifecycle auditável.
- `export_artifacts`: fila/estado/hash/localização de PDF, PPTX e XLSX.
- `audit_events`: before/after hash, ator, ação e metadata.

## Invariantes

- tenant vem da sessão, não do payload do cliente;
- versões baseline são imutáveis;
- snapshot oficial referencia formula set e input hash;
- todo mutador de domínio financeiro incrementa `financialRevision` na mesma transação; comandos calculados, como Goal Seek, revalidam essa revisão antes do commit;
- comparações de cenário só são analiticamente comparáveis quando horizonte e `asOfMonth` coincidem; seleção e pack exportado incorporam essa identidade;
- approval/baseline têm restrições de idempotência;
- componente lógico não pode duplicar identidade; a migration `0011` deduplica legado preservando o registro mais recente antes de criar a unique key;
- a migration `0016` classifica linhas legadas de custo como `included_in_project_totals`, impedindo dupla contagem retroativa; cenários clonam o catálogo e seu tratamento;
- ausências materiais bloqueiam cálculo ou permanecem `PENDING`, conforme o domínio.

O schema executável está em `drizzle/schema.ts`; migrations são a autoridade para upgrade e são provadas em MySQL 8 efêmero.
