param([string]$OutputPath = (Join-Path $PSScriptRoot '..\dist\data\research.json'))
$ErrorActionPreference = 'Stop'
$sdkBin = Join-Path $env:LOCALAPPDATA 'Google\Cloud SDK\google-cloud-sdk\bin'
$env:Path = "$sdkBin;$env:Path"
$bq = Join-Path $sdkBin 'bq.cmd'
$projectId = 'project-89aca125-c9a5-4fdd-bb0'
$datasetId = 'flame_in_freefall_2026'
function Read-BigQueryJson([string[]]$BqArguments) {
    $result = & $bq "--project_id=$projectId" --format=json @BqArguments
    if ($LASTEXITCODE -ne 0) { throw "BigQuery read failed: $($BqArguments[0])" }
    return (($result -join "`n") | ConvertFrom-Json)
}
$specs = @(
    @{name='sources';fields='source_id,source_type,title,url,doi,publication_date,source_authority'},
    @{name='experiments';fields='experiment_id,source_id,context_type,material,gravity_label,gravity_nominal_g,gravity_basis,platform,pressure_psia,pressure_kpa,pressure_reported,oxygen_pct,flow_speed_cm_s,flow_mode,duration_s,conditions,comparability_group,limitation'},
    @{name='measurements';fields='measurement_id,experiment_id,source_id,metric,value,unit,normalized_value,normalized_unit,conversion,evidence_type,independent_raw_trial,pdf_page,locator,reliability_label,uncertainty_value,uncertainty_unit,uncertainty_status,limitation'},
    @{name='evidence';fields='evidence_id,source_id,statement,language,evidence_type,locator,pdf_page,related_measurement_ids,reliability_label,limitation'}
)
$bundle = [ordered]@{
    schemaVersion='1.0.0'
    exportedAt=[DateTime]::UtcNow.ToString('o')
    dataset=$datasetId
    project=$projectId
    mode='BigQuery snapshot'
    tableCounts=[ordered]@{}
}
foreach ($table in @('sources','experiments','measurements','evidence','raw_records','files','resource_links','download_events')) {
    $meta = Read-BigQueryJson @('show',"${projectId}:${datasetId}.$table")
    $bundle.tableCounts[$table] = [long]$meta.numRows
}
foreach ($spec in $specs) {
    $rows = @(Read-BigQueryJson @('head','--max_rows=10000',"--selected_fields=$($spec.fields)","${projectId}:${datasetId}.$($spec.name)"))
    if ($rows.Count -ne $bundle.tableCounts[$spec.name]) { throw "Incomplete snapshot for $($spec.name)" }
    $bundle[$spec.name] = $rows
}
$bundle['notes'] = @(
    'Scientific research records exported from Team Soraine BigQuery. Values describe the cited experiments, not a prediction of habitat fire risk.',
    'The file count represents catalogue entries, not downloaded or individually reviewed assets.',
    'The public export excludes credentials, personal account details, local file paths, download logs and raw file manifests.'
)
$outputDirectory = Split-Path $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$bundle | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $OutputPath -Encoding utf8
[pscustomobject]@{Path=[IO.Path]::GetFullPath($OutputPath);ExportedAt=$bundle.exportedAt;Tables=$bundle.tableCounts;Bytes=(Get-Item -LiteralPath $OutputPath).Length} | ConvertTo-Json
