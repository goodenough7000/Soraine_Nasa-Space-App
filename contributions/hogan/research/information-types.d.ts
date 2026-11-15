export type SceneId = 'earth' | 'moon' | 'mars' | 'microgravity';
export type ObjectId = 'stove' | 'pan' | 'egg' | 'canister' | 'plant' | 'droplets' | 'utensils' | 'habitat' | 'sample-ultem' | 'sample-nomex' | 'sample-wire' | 'sample-pet' | 'sample-pmma' | 'smoke-detector' | 'extinguisher';
export interface Selection {
  objectId: ObjectId | string;
  sceneId: SceneId;
  atmosphereId?: 'illustrative-air' | 'illustrative-enriched';
  caseId?: string;
  cabinOverrides?: {
    oxygen_percent?: number | null;
    pressure_kpa_absolute?: number | null;
    airflow_mm_s?: number | null;
  };
}
export interface InspectEventDetail extends Selection {}
export interface MeasurementRow {
  evidenceId: string; metric: string; label: string;
  value: number | string | null; displayValue: string;
  unit: string | null; explanation: string | null;
  evidenceType: string; sourceId: string; sourceLocation: string;
}
export interface Source {id:string; title:string|null; url:string; alternate_urls:string[]}
export interface Material {id:string; label:string; geometry:string; record_ids:string[]}
export interface TestCase {
  id:string; material_id:string; scene_id:SceneId; label:string; record_ids:string[];
  metric_view:string; compare_group:string; context:string; chart_mode:string;
  allow_scene_prediction:false;
}
export interface ObjectPanel {
  objectId: ObjectId; title: string; role:'concept'|'material'|'finding';
  material: Material|null;
  card: {title:string; summary:string; sections:{heading:string;body:string}[]; related_object_ids:ObjectId[]};
  sceneConditions: {id:SceneId; gravity_nominal_g:number; atmosphere:{label:string;oxygen_percent:number|null;pressure_kpa_absolute:number|null;airflow_mm_s:number|null;basis:string}};
  evidenceState: 'published_test'|'no_matching_case'|'no_experiment'|'concept'|'finding';
  availableCases: {id:string;label:string}[];
  selectedCase: TestCase|null;
  comparisonCases: TestCase[];
  measurements: MeasurementRow[];
  testConditions: unknown[]; relatedFindings: unknown[]; relatedEvidence: unknown[];
  sources: Source[]; scope:string|null; emptyMessage:string|null;
  animationPolicy:'illustrative_only';
}
