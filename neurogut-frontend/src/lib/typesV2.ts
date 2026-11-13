/* NeuroGut v2 (Parkinson's / schizophrenia) API types -- see neurogut-backend/api/predict_v2.py */
export type Disease = "scz" | "pd";

export interface V2Feature {
  name: string; lineage: string; rank: string; healthy_median_pct: number; higher_in: "disease" | "healthy";
}

export interface V2Model {
  disease: Disease; label: string; version: string; n_train: number; n_cases: number; threshold: number;
  tiers: { low: number; high: number }; source: string; features: V2Feature[];
  metrics: { internal_auc: number; external_auc: number | null; balanced_accuracy_at_threshold: number; f1_at_threshold: number };
}

export interface V2Driver { taxon: string; value_pct: number; healthy_median_pct: number; z: number; push: number }

export interface V2Prediction {
  id: string; disease: Disease; patient_id: string | null; patient_code: string | null; sample_label: string;
  collection_date: string | null; input_method: string; probability: number; label: number;
  risk_tier: "low" | "moderate" | "high"; model_probs: Record<string, number>; drivers: V2Driver[];
  missing_taxa: number; abundances: Record<string, number>; model_version: string; created_at: string | null;
}

export interface V2CsvResult {
  format: "profile" | "rows"; n_predicted: number; results: V2Prediction[]; errors: { row: string | number; error: string }[];
}
