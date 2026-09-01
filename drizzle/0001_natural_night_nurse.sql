CREATE TABLE `approval_decisions` (
	`id` varchar(64) NOT NULL,
	`snapshotId` varchar(64) NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`rationale` varchar(2000) NOT NULL,
	`decidedBy` int NOT NULL,
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` varchar(64) NOT NULL,
	`tenantId` int NOT NULL,
	`entityType` varchar(120) NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`action` varchar(160) NOT NULL,
	`actorId` int NOT NULL,
	`beforeHash` varchar(64),
	`afterHash` varchar(64),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calculation_snapshots` (
	`id` varchar(64) NOT NULL,
	`projectVersionId` varchar(64) NOT NULL,
	`formulaSetVersionId` varchar(64) NOT NULL,
	`horizonMonths` int NOT NULL,
	`inputHash` varchar(64) NOT NULL,
	`snapshotHash` varchar(64) NOT NULL,
	`calculationStatus` enum('valid','blocked_by_pending_inputs','invalid') NOT NULL,
	`validationStatus` enum('pending','valid','failed') NOT NULL DEFAULT 'pending',
	`isAuthoritative` boolean NOT NULL DEFAULT false,
	`payload` json NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calculation_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `calculation_snapshots_hash_unique` UNIQUE(`snapshotHash`)
);
--> statement-breakpoint
CREATE TABLE `export_artifacts` (
	`id` varchar(64) NOT NULL,
	`snapshotId` varchar(64) NOT NULL,
	`format` enum('pdf','pptx') NOT NULL,
	`status` enum('queued','generated','failed') NOT NULL DEFAULT 'queued',
	`storageKey` varchar(500),
	`generatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `export_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `formula_set_versions` (
	`id` varchar(64) NOT NULL,
	`semanticVersion` varchar(32) NOT NULL,
	`engineVersion` varchar(64) NOT NULL,
	`status` enum('draft','published','retired') NOT NULL DEFAULT 'draft',
	`definitions` json NOT NULL,
	`publishedBy` int,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `formula_set_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `formula_set_versions_semantic_unique` UNIQUE(`semanticVersion`)
);
--> statement-breakpoint
CREATE TABLE `input_values` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`key` varchar(160) NOT NULL,
	`status` enum('provided','pending') NOT NULL,
	`valueText` varchar(255),
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `input_values_id` PRIMARY KEY(`id`),
	CONSTRAINT `input_values_version_key_unique` UNIQUE(`versionId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `kpi_memory_records` (
	`id` varchar(64) NOT NULL,
	`snapshotId` varchar(64) NOT NULL,
	`kpiKey` varchar(160) NOT NULL,
	`valueText` varchar(255),
	`formulaId` varchar(160) NOT NULL,
	`formulaVersion` varchar(32) NOT NULL,
	`dependencyKeys` json NOT NULL,
	`explanation` varchar(2000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kpi_memory_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `kpi_memory_snapshot_key_unique` UNIQUE(`snapshotId`,`kpiKey`)
);
--> statement-breakpoint
CREATE TABLE `project_versions` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`parentVersionId` varchar(64),
	`formulaSetVersionId` varchar(64) NOT NULL,
	`kind` enum('working','scenario','approval','baseline') NOT NULL DEFAULT 'working',
	`state` enum('draft','in_review','approved','baseline') NOT NULL DEFAULT 'draft',
	`isImmutable` boolean NOT NULL DEFAULT false,
	`inputHash` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`vertical` varchar(120) NOT NULL DEFAULT 'multipropriedade',
	`status` enum('draft','in_review','approved','baseline') NOT NULL DEFAULT 'draft',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_branches` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`baseVersionId` varchar(64) NOT NULL,
	`branchVersionId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`reason` varchar(1000) NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
CREATE INDEX `approval_decisions_snapshot_idx` ON `approval_decisions` (`snapshotId`);--> statement-breakpoint
CREATE INDEX `audit_events_tenant_entity_idx` ON `audit_events` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `calculation_snapshots_version_idx` ON `calculation_snapshots` (`projectVersionId`);--> statement-breakpoint
CREATE INDEX `calculation_snapshots_authority_idx` ON `calculation_snapshots` (`isAuthoritative`,`validationStatus`);--> statement-breakpoint
CREATE INDEX `export_artifacts_snapshot_idx` ON `export_artifacts` (`snapshotId`);--> statement-breakpoint
CREATE INDEX `input_values_version_idx` ON `input_values` (`versionId`);--> statement-breakpoint
CREATE INDEX `project_versions_project_idx` ON `project_versions` (`projectId`);--> statement-breakpoint
CREATE INDEX `project_versions_parent_idx` ON `project_versions` (`parentVersionId`);--> statement-breakpoint
CREATE INDEX `project_versions_formula_idx` ON `project_versions` (`formulaSetVersionId`);--> statement-breakpoint
CREATE INDEX `projects_tenant_idx` ON `projects` (`tenantId`);--> statement-breakpoint
CREATE INDEX `projects_creator_idx` ON `projects` (`createdBy`);--> statement-breakpoint
CREATE INDEX `scenario_branches_project_idx` ON `scenario_branches` (`projectId`);