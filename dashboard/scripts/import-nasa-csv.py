"""Preserve NASA CSV strings and emit a reviewable BigQuery load file."""
import csv
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'source-data/manifest.json').read_text())
target = root / 'dist/data/original-data.json'
bundle = json.loads(target.read_text(encoding='utf-8-sig'))
datasets = {item['id']: item for item in bundle['datasets']}
for source in manifest:
    path = root / 'source-data' / (source['id'] + '.csv')
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
    with path.open(encoding='utf-8-sig', newline='') as handle:
        table = list(csv.reader(handle))
    columns, records = table[0], table[1:]
    assert all(len(row) == len(columns) for row in records)
    rows = []
    for number, cells in enumerate(records, 2):
        kind = 'pretest_reference' if source['id'] == 'saffire-i' and number >= 4 else 'source_record'
        rows.append(dict(id=f"{source['sourceId']}:{number}", csvRecordNumber=number, cells=cells, rowKind=kind))
    datasets[source['id']] = dict(id=source['id'], title=source['title'], sourceId=source['sourceId'],
        sourceUrl=source['sourceUrl'], sha256=source['sha256'], columns=columns, rows=rows)
bundle['datasets'] = sorted(datasets.values(), key=lambda item: item['id'])
bundle['exportedAt'] = datetime.now(timezone.utc).isoformat()
target.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
output = root / 'source-data/public-experiment-rows.ndjson'
with output.open('w', encoding='utf-8', newline='\n') as handle:
    for dataset in bundle['datasets']:
        for row in dataset['rows']:
            record = dict(dataset_id=dataset['id'], title=dataset['title'], source_id=dataset['sourceId'],
                source_url=dataset['sourceUrl'], source_sha256=dataset['sha256'], headers=dataset['columns'],
                cells=row['cells'], record_id=row['id'], csv_record_number=row['csvRecordNumber'], row_kind=row['rowKind'])
            handle.write(json.dumps(record, ensure_ascii=False) + '\n')
print(json.dumps({item['id']: len(item['rows']) for item in bundle['datasets']}))
