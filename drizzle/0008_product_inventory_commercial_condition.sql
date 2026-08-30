CREATE TABLE `commercial_conditions` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`productSkuId` varchar(64),
	`conditionCode` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`listPriceText` varchar(255) NOT NULL,
	`discountText` varchar(255) NOT NULL DEFAULT '0',
	`entryTotalText` varchar(255) NOT NULL,
	`entryInstallments` int NOT NULL,
	`entryFirstDueMonth` int NOT NULL,
	`balancePrincipalText` varchar(255) NOT NULL,
	`balanceInstallments` int NOT NULL,
	`graceMonths` int NOT NULL DEFAULT 0,
	`balanceFirstDueMonth` int NOT NULL,
	`explicitChargesText` varchar(255) NOT NULL DEFAULT '0',
	`correctionRateText` varchar(255),
	`interestRateText` varchar(255),
	`materialityToleranceText` varchar(255) NOT NULL DEFAULT '0.01',
	`campaign` varchar(255),
	`status` enum('provided','pending') NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commercial_conditions_id` PRIMARY KEY(`id`),
	CONSTRAINT `commercial_conditions_version_code_unique` UNIQUE(`versionId`,`conditionCode`)
);
--> statement-breakpoint
CREATE TABLE `product_price_phases` (
	`id` varchar(64) NOT NULL,
	`productSkuId` varchar(64) NOT NULL,
	`phaseCode` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`startsAtMonth` int NOT NULL,
	`priceText` varchar(255) NOT NULL,
	`promotionalPriceText` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_price_phases_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_price_phases_sku_code_unique` UNIQUE(`productSkuId`,`phaseCode`),
	CONSTRAINT `product_price_phases_sku_month_unique` UNIQUE(`productSkuId`,`startsAtMonth`)
);
--> statement-breakpoint
CREATE TABLE `product_skus` (
	`id` varchar(64) NOT NULL,
	`versionId` varchar(64) NOT NULL,
	`skuCode` varchar(120) NOT NULL,
	`name` varchar(255) NOT NULL,
	`unitType` varchar(255) NOT NULL,
	`unitQuantity` int NOT NULL,
	`sharesPerUnit` int NOT NULL,
	`grossSoldShares` int NOT NULL DEFAULT 0,
	`returnedShares` int NOT NULL DEFAULT 0,
	`blockedShares` int NOT NULL DEFAULT 0,
	`status` enum('provided','pending') NOT NULL,
	`sourceType` enum('current_decision','current_document','historical_primary','derived_analysis','external_benchmark','assumption') NOT NULL,
	`sourceRef` varchar(500),
	`updatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_skus_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_skus_version_code_unique` UNIQUE(`versionId`,`skuCode`)
);
--> statement-breakpoint
ALTER TABLE `commercial_conditions` ADD CONSTRAINT `commercial_conditions_versionId_project_versions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `project_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_conditions` ADD CONSTRAINT `commercial_conditions_productSkuId_product_skus_id_fk` FOREIGN KEY (`productSkuId`) REFERENCES `product_skus`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_price_phases` ADD CONSTRAINT `product_price_phases_productSkuId_product_skus_id_fk` FOREIGN KEY (`productSkuId`) REFERENCES `product_skus`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_skus` ADD CONSTRAINT `product_skus_versionId_project_versions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `project_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `commercial_conditions_version_idx` ON `commercial_conditions` (`versionId`);--> statement-breakpoint
CREATE INDEX `commercial_conditions_sku_idx` ON `commercial_conditions` (`productSkuId`);--> statement-breakpoint
CREATE INDEX `product_price_phases_sku_idx` ON `product_price_phases` (`productSkuId`);--> statement-breakpoint
CREATE INDEX `product_skus_version_idx` ON `product_skus` (`versionId`);