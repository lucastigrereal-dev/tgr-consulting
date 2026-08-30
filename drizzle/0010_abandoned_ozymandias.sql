CREATE TABLE `receivables_policies` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`cancellationD7Text` varchar(255) NOT NULL,
	`cancellationD30Text` varchar(255) NOT NULL,
	`cancellationD60Text` varchar(255) NOT NULL,
	`cancellationD90Text` varchar(255) NOT NULL,
	`cancellationD180Text` varchar(255) NOT NULL,
	`cancellationLifetimeText` varchar(255) NOT NULL,
	`delinquencyRateText` varchar(255) NOT NULL,
	`cureDays1To30Text` varchar(255) NOT NULL,
	`cureDays31To60Text` varchar(255) NOT NULL,
	`cureDays61To90Text` varchar(255) NOT NULL,
	`cureDays90PlusText` varchar(255) NOT NULL,
	`writeOffAfterDays` int NOT NULL,
	`policyVersion` varchar(120) NOT NULL,
	`status` enum('provided','pending') NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivables_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `receivables_policies_version_unique` UNIQUE(`versionId`)
);
--> statement-breakpoint
ALTER TABLE `receivables_policies` ADD CONSTRAINT `receivables_policies_versionId_project_versions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `project_versions`(`id`) ON DELETE cascade ON UPDATE no action;