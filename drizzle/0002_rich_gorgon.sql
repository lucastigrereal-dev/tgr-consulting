CREATE TABLE `formula_definition_provenance` (
	`id` varchar(64) NOT NULL,
	`formulaSetVersionId` varchar(64) NOT NULL,
	`formulaId` varchar(160) NOT NULL,
	`formulaVersion` varchar(32) NOT NULL,
	`expression` varchar(4000) NOT NULL,
	`dependencyKeys` json NOT NULL,
	`description` varchar(2000) NOT NULL,
	`sourceRef` varchar(500) NOT NULL,
	`publishedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `formula_definition_provenance_id` PRIMARY KEY(`id`),
	CONSTRAINT `formula_definition_provenance_unique` UNIQUE(`formulaSetVersionId`,`formulaId`)
);
--> statement-breakpoint
CREATE TABLE `workflow_events` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`fromState` enum('draft','in_review','approved','baseline'),
	`toState` enum('draft','in_review','approved','baseline') NOT NULL,
	`action` varchar(160) NOT NULL,
	`rationale` varchar(2000),
	`actorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `formula_definition_provenance_set_idx` ON `formula_definition_provenance` (`formulaSetVersionId`);--> statement-breakpoint
CREATE INDEX `workflow_events_project_idx` ON `workflow_events` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `workflow_events_version_idx` ON `workflow_events` (`versionId`,`createdAt`);