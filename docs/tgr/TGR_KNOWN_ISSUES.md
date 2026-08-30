# TGR Consulting — Known Issues

## P0 — release blockers

1. **The BRD master journey is not implemented end to end.** Product/inventory and commercial-condition reconciliation are now authoritative and operable in the Builder, but capture-point economics, sales cohorts, receivables, delinquency/cure and Healthy D90 are not yet authoritative domain modules.
2. **Indexed payment schedules and portfolio accounting remain release blockers.** Entry, explicit charges and balance installments now generate an authoritative Payment Calendar, but positive correction/interest still require an explicit periodicity/index contract; cancellation, delinquency, cure and Healthy D90 remain aggregate rates rather than cohort/ledger events.
3. **Production credentials and infrastructure are absent from this checkout.** OAuth, database and object storage behavior cannot be called production-ready without an authorized environment.
4. **Production credentials and infrastructure remain an external release gate.** Local MySQL integration is proven, but OAuth, object storage, backup and deployment behavior still require an authorized production-like environment.

## P1 — material product gaps

1. XLSX now exports snapshot KPIs, formula memory and monthly projections, but inputs/status/source provenance are not embedded in the snapshot payload and therefore cannot yet be reconciled into the workbook.
2. PDF and PPTX are valid artifacts but still represent an executive summary, not the multi-chapter investor pack required by the BRD.
3. Goal Seek remains V0: two target KPIs and two economically free levers. Bounds are validated, but non-monotonic objective detection and multi-objective constraints are not implemented.
4. Boardroom exists and is tested at component level, but fullscreen 1920×1080, keyboard navigation, 200% zoom and visual-regression evidence are not proven.
5. Backup, retention, RPO/RTO and restore drill are not implemented or proven.
6. Structured observability, security headers, rate limiting and production error-redaction evidence remain incomplete.
7. The repository contains extensive discovery and product notes, but the BRD's final canonical set — product BRD, architecture, formula dictionary, data dictionary, E2E matrix, security checklist and operational runbook — is not yet reconciled into one authoritative documentation suite.

## Corrected during this round

1. A partially informed CAPEX implementation schedule can no longer fall back silently to uniform allocation.
2. Material unit rates, payment mix shares and MDR values are rejected outside the 0–100% interval.
3. Unresolved analytics placeholders are no longer emitted into the production HTML.
4. XLSX was added to the same approved-snapshot export flow used by PDF/PPTX, including schema migration and Boardroom action.
5. The authorized export path now attaches the authoritative database-row hash to the persisted calculation payload before building or storing an artifact.
6. Negative economic volumes and monetary inputs are rejected instead of producing plausible-looking invalid projections.
7. User-facing export, README and governance labels now consistently identify TGR Consulting; legacy `IGR_*` technical identifiers remain unchanged to avoid an unrelated compatibility migration.
8. Product, inventory, price phases and commercial conditions now persist as normalized domains and drive ticket, entry and inventory limits across snapshot, simulation, Capital Envelope and Goal Seek.
9. Builder now exposes the authoritative product/commercial editor and the calculate action; Boardroom and Scenario Lab propagate the price-reference month and show domain blockers.
10. MySQL 8.4 integration tests now exercise authority, tenant isolation, rollback, baseline, scenarios, exports, product and commercial conditions locally through the repository test harness.
11. Builder saves the complete product catalog and its commercial conditions through one backend transaction; a forced condition-write failure proves full rollback of both domains.
12. Reconciled commercial conditions now generate a weighted Payment Calendar per contract. Snapshots separate entry, gross receivables, settled receivables, installment collections and payment fees without floating-point arithmetic.
