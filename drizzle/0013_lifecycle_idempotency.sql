DELETE newer
FROM `approval_decisions` AS newer
INNER JOIN `approval_decisions` AS keeper
  ON newer.`snapshotId` = keeper.`snapshotId`
  AND newer.`decision` = keeper.`decision`
  AND (
    newer.`decidedAt` > keeper.`decidedAt`
    OR (newer.`decidedAt` = keeper.`decidedAt` AND newer.`id` > keeper.`id`)
  );
--> statement-breakpoint
ALTER TABLE `approval_decisions` ADD CONSTRAINT `approval_decisions_snapshot_decision_unique` UNIQUE(`snapshotId`,`decision`);
