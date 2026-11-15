-- Add reviewed source records without replacing or deleting existing rows.
BEGIN TRANSACTION;
ASSERT (
  SELECT COUNT(*) = 381 AND COUNT(DISTINCT record_id) = 381
  FROM `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.source_import_20261115`
) AS 'The staged source bundle is incomplete or duplicated';
ASSERT NOT EXISTS (
  SELECT 1 FROM `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.public_experiment_rows` AS existing
  JOIN `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.source_import_20261115` AS incoming USING (record_id)
  WHERE TO_JSON_STRING(existing) != TO_JSON_STRING(incoming)
) AS 'An existing record differs; review before changing source data';
MERGE `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.public_experiment_rows` AS existing
USING `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.source_import_20261115` AS incoming
ON existing.record_id = incoming.record_id
WHEN NOT MATCHED THEN INSERT ROW;
COMMIT TRANSACTION;
