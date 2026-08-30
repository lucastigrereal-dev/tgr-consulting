# TGR Consulting — Known Issues

## P0 — release blockers

1. **The BRD master journey is not implemented end to end.** Product/inventory, commercial conditions, Payment Calendar and an aggregate monthly sales-cohort/receivables ledger are authoritative. Capture-point economics, room capacity, workforce/training cohorts and commission policy are still not authoritative domain modules.
2. **Portfolio accounting is not yet contract-complete.** Cancellation, delinquency, conditional cure, write-off, aging and Healthy D90 are separated and feed cash, scenarios and Goal Seek, but cohorts do not yet carry product/channel/capture-point dimensions. Refunds, commission reversal and inventory return after cancellation are not modeled.
3. **Positive correction and interest remain blocked.** Entry, explicit charges and balance installments generate an authoritative Payment Calendar, but indexed correction/interest require an explicit index, periodicity and capitalization contract before they may enter an official snapshot.
4. **Production credentials and infrastructure remain an external release gate.** Local MySQL integration is proven, but OAuth, object storage, backup/restore, deployment and the complete authenticated browser journey require an authorized production-like environment.

## P1 — material product gaps

1. XLSX now exports snapshot KPIs, formula memory and monthly projections, but inputs/status/source provenance are not embedded in the snapshot payload and therefore cannot yet be reconciled into the workbook.
2. PDF and PPTX are valid artifacts but still represent an executive summary, not the multi-chapter investor pack required by the BRD.
3. Goal Seek remains V0: three target KPIs (including Healthy D90) and two economically free levers. Bounds are validated, but non-monotonic objective detection and multi-objective constraints are not implemented.
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
13. A normalized, tenant-protected receivables policy now controls cumulative cancellation, delinquency, conditional cure and write-off by version; missing or pending policy blocks the authoritative snapshot.
14. The financial engine now materializes monthly sales cohorts, receivables ledger, aging, cures, write-off and Healthy D90; the Boardroom, XLSX and Goal Seek consume the same formula-set `1.5.0` outputs.
