-- Legacy bootstrap for the original two files. The expanded collection uses
-- import-nasa-csv.py and extend-original-data.sql. Never overwrite added files.
ASSERT NOT EXISTS (
  SELECT 1 FROM `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.public_experiment_rows`
  WHERE dataset_id NOT IN ('bass-ii', 'saffire-ii')
) AS 'Expanded source collection exists; use the additive import workflow';
-- Public copies of two verified NASA CSVs. Run only after reviewing this table's
-- output; grant the runtime identity access to this table, not to raw_records/files.
-- Rows, notes, headers and units are preserved. No paths or download logs publish.
CREATE OR REPLACE TABLE
  `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.public_experiment_rows`
OPTIONS(description = 'Original NASA BASS-II and Saffire-II CSV rows with public provenance; source strings unchanged.')
AS
SELECT
  CASE r.investigation_id WHEN 'PSI-25' THEN 'bass-ii' ELSE 'saffire-ii' END AS dataset_id,
  CASE r.investigation_id WHEN 'PSI-25' THEN 'BASS-II' ELSE 'Saffire-II' END AS title,
  r.source_id,
  s.url AS source_url,
  r.source_sha256,
  r.source_header AS headers,
  r.cells,
  r.record_id,
  r.csv_record_number,
  CASE
    WHEN r.investigation_id = 'PSI-99' AND r.csv_record_number BETWEEN 13 AND 16 THEN 'source_note'
    WHEN r.investigation_id = 'PSI-99' AND r.csv_record_number IN (11, 12) THEN 'pretest_reference'
    WHEN r.investigation_id = 'PSI-99' AND r.csv_record_number BETWEEN 2 AND 10 THEN 'test_record'
    ELSE 'source_record'
  END AS row_kind
FROM `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.raw_records` AS r
JOIN `project-89aca125-c9a5-4fdd-bb0.flame_in_freefall_2026.sources` AS s
  ON r.source_id = s.source_id
WHERE
  (r.investigation_id = 'PSI-25'
   AND r.source_id = 'CSV-fa0a9a6e384c7e455825173a'
   AND r.source_sha256 = '71e792bf6b5fb5ea620c5dd70fbbac05515992e12aefcf5dff47312caa48c042')
  OR
  (r.investigation_id = 'PSI-99'
   AND r.source_id = 'CSV-e7a94940d9d2f3c035985141'
   AND r.source_sha256 = '3c24390b9ef86f3d1ebaab911a1a3cc95a8759aebf42062371370e6d4b31b8ac');
