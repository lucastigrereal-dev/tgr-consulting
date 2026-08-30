CREATE TABLE `historical_benchmarks` (
	`id` varchar(64) NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`vertical` varchar(120) NOT NULL,
	`periodLabel` varchar(120) NOT NULL,
	`status` enum('provided','pending') NOT NULL,
	`metrics` json NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `historical_benchmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_component_records` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`componentType` enum('product_stock','pricing_payments','acquisition_capacity','costs_workforce','commissions_partners','receivables_losses','capex_opex') NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('provided','pending') NOT NULL,
	`payload` json NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_component_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `historical_benchmarks_tenant_idx` ON `historical_benchmarks` (`tenantId`,`vertical`);--> statement-breakpoint
CREATE INDEX `project_component_records_version_idx` ON `project_component_records` (`versionId`,`componentType`);