CREATE TABLE `cost_catalog_items` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`category` enum('payroll','occupancy','technology','marketing','partner','legal','operations','other') NOT NULL,
	`name` varchar(255) NOT NULL,
	`frequency` enum('monthly','annual','one_time') NOT NULL,
	`amountText` varchar(255),
	`status` enum('provided','pending') NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cost_catalog_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cost_catalog_items_version_idx` ON `cost_catalog_items` (`versionId`,`category`);