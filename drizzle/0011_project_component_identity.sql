-- Existing databases may contain more than one record for the logical
-- component identity introduced by this migration. Keep the most recently
-- updated row (using the id as a deterministic tie-breaker) before enforcing
-- the invariant, so an upgrade does not fail halfway through.
DELETE stale
FROM `project_component_records` AS stale
INNER JOIN `project_component_records` AS winner
  ON stale.`versionId` = winner.`versionId`
  AND stale.`componentType` = winner.`componentType`
  AND stale.`name` = winner.`name`
  AND (
    stale.`updatedAt` < winner.`updatedAt`
    OR (stale.`updatedAt` = winner.`updatedAt` AND stale.`id` < winner.`id`)
  );
--> statement-breakpoint
ALTER TABLE `project_component_records` ADD CONSTRAINT `project_component_records_version_type_name_unique` UNIQUE(`versionId`,`componentType`,`name`);
