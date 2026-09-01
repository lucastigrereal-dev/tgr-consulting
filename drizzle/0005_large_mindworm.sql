CREATE TABLE `decision_records` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`inputKey` varchar(160),
	`title` varchar(255) NOT NULL,
	`decisionValue` varchar(1000) NOT NULL,
	`rationale` varchar(2000) NOT NULL,
	`responsible` varchar(255) NOT NULL,
	`sourceRef` varchar(500),
	`status` enum('proposed','accepted') NOT NULL DEFAULT 'accepted',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `decision_records_project_idx` ON `decision_records` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `decision_records_version_idx` ON `decision_records` (`versionId`,`createdAt`);