# TGR Consulting — Known Issues

## P0 — release blockers

1. **Authenticated database E2E is not proven.** The two existing integration tests require MySQL/TiDB. No compatible local runtime was available and remote image pulls stalled.
2. **The BRD master journey is not implemented end to end.** Product/inventory, structured commercial-condition reconciliation, capture-point economics, sales cohorts, receivables, delinquency/cure and Healthy D90 do not exist as authoritative domain modules. Some appear only as generic Builder payload fields.
3. **Production credentials and infrastructure are absent from this checkout.** OAuth, database and object storage behavior cannot be called production-ready without an authorized environment.
4. **Critical persistence transitions are not proven atomic.** Snapshot creation, approval/baseline promotion and export persistence span multiple writes without demonstrated rollback behavior. Refactoring these flows without a working MySQL integration environment would replace a known risk with an unverified one.

## P1 — material product gaps

1. XLSX now exports snapshot KPIs, formula memory and monthly projections, but inputs/status/source provenance are not embedded in the snapshot payload and therefore cannot yet be reconciled into the workbook.
2. PDF and PPTX are valid artifacts but still represent an executive summary, not the multi-chapter investor pack required by the BRD.
3. Goal Seek remains V0: two target KPIs and three levers. Non-monotonic objective detection and multi-objective constraints are not implemented.
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
