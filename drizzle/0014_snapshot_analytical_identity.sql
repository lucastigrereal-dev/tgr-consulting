ALTER TABLE `calculation_snapshots` ADD `asOfMonth` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `calculation_snapshots`
SET `asOfMonth` = COALESCE(
  CAST(JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.authoritativeDomains.asOfMonth')) AS UNSIGNED),
  0
);
--> statement-breakpoint
ALTER TABLE `calculation_snapshots` ADD `createdOrdinal` bigint unsigned NULL;
--> statement-breakpoint
UPDATE `calculation_snapshots` AS target
INNER JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (ORDER BY `createdAt` ASC, `id` ASC) AS `ordinal`
  FROM `calculation_snapshots`
) AS ranked ON ranked.`id` = target.`id`
SET target.`createdOrdinal` = ranked.`ordinal`;
--> statement-breakpoint
ALTER TABLE `calculation_snapshots`
  MODIFY `createdOrdinal` bigint unsigned NOT NULL AUTO_INCREMENT,
  ADD CONSTRAINT `calculation_snapshots_created_ordinal_unique` UNIQUE(`createdOrdinal`);
