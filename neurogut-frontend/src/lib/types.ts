/* NEUROGUT -- TypeScript type definitions */

export interface User {
  id: string;
  email: string;
  role: "admin" | "clinician" | "researcher";
  full_name: string;
  is_active: boolean;
  hospital_id: string;
  // v4.0: lifecycle fields
  status: "invited" | "active" | "deactivated";
  invite_expires_at: string | null;
  last_login_at: string | null;
  created_at: string | null;
}


export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
  full_name: string;
  hospital_id: string;
}

export interface Patient {
  id: string;
  hospital_id: string;
  patient_code: string;
  age: number | null;
  sex: string;
  notes: string;
  created_at: string | null;
}

export interface PatientDetail extends Patient {
  samples: SampleWithPrediction[];
}

export interface Sample {
  id: string;
  patient_id: string;
  collection_date: string;
  input_method: string;
  created_at: string | null;
}

export interface SampleWithPrediction extends Sample {
  prediction: PredictionSummary | null;
}

export interface PredictionSummary {
  id: string;
  depression_prob: number;
  anxiety_prob: number;
  depression_label: number;
  anxiety_label: number;
  risk_tier: RiskTier;
  created_at: string;
}

export interface PredictionInput {
  lachnospira: number;
  ruthenibacterium: number;
  veillonella: number;
  gardnerella: number;
  pseudobutyrivibrio: number;
  kocuria: number;
  trueperella: number;
  lancefieldella: number;
  fructilactobacillus: number;
  lachnoanaerobaculum: number;
  corynebacterium: number;
  raoultella: number;
  lawsonella: number;
}

export interface PredictionResult {
  prediction_id: string;
  sample_id: string;
  depression_prob: number;
  anxiety_prob: number;
  depression_label: number;
  anxiety_label: number;
  risk_tier: RiskTier;
  rf_importances: Record<string, number>;
  xgb_importances: Record<string, number>;
  consensus_features: string[];
  processing_time_ms: number;
  model_version: string;
  // v2.0: Confidence intervals
  depression_ci_low?: number;
  depression_ci_high?: number;
  anxiety_ci_low?: number;
  anxiety_ci_high?: number;
  bootstrap_iterations?: number;
}

export interface ModelHealth {
  model_version: string;
  model_loaded: boolean;
  feature_count: number;
  prediction_count: number;
  avg_latency_ms: number;
}

export interface Report {
  id: string;
  prediction_id: string;
  file_path: string;
  report_version: number;
  report_hash?: string;
  created_at: string | null;
}

export type RiskTier = "healthy" | "depression_only" | "anxiety_only" | "comorbid";

export const RISK_CONFIG: Record<RiskTier, { label: string; color: string; bg: string; badge: string }> = {
  healthy: { label: "Healthy", color: "#22C55E", bg: "#F0FDF4", badge: "badge-healthy" },
  depression_only: { label: "Depression", color: "#F59E0B", bg: "#FFFBEB", badge: "badge-moderate" },
  anxiety_only: { label: "Anxiety", color: "#F59E0B", bg: "#FFFBEB", badge: "badge-moderate" },
  comorbid: { label: "Comorbid", color: "#EF4444", bg: "#FEF2F2", badge: "badge-high" },
};

export const TAXA_NAMES: (keyof PredictionInput)[] = [
  "lachnospira", "ruthenibacterium", "veillonella", "gardnerella",
  "pseudobutyrivibrio", "kocuria", "trueperella", "lancefieldella",
  "fructilactobacillus", "lachnoanaerobaculum", "corynebacterium",
  "raoultella", "lawsonella",
];

export const TAXA_DISPLAY: Record<string, string> = {
  lachnospira: "Lachnospira",
  ruthenibacterium: "Ruthenibacterium",
  veillonella: "Veillonella",
  gardnerella: "Gardnerella",
  pseudobutyrivibrio: "Pseudobutyrivibrio",
  kocuria: "Kocuria",
  trueperella: "Trueperella",
  lancefieldella: "Lancefieldella",
  fructilactobacillus: "Fructilactobacillus",
  lachnoanaerobaculum: "Lachnoanaerobaculum",
  corynebacterium: "Corynebacterium",
  raoultella: "Raoultella",
  lawsonella: "Lawsonella",
};

// ====== v2.0 Types ======

export interface Alert {
  id: string;
  prediction_id: string;
  patient_id: string;
  patient_code?: string;
  triggered_by_rule: string;
  status: "unread" | "read" | "resolved" | "escalated";
  depression_prob?: number;
  anxiety_prob?: number;
  risk_tier?: string;
  notes: string;
  created_at: string | null;
}

export interface AlertCount {
  unread: number;
  total: number;
}

export interface AuditEntry {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  created_at: string | null;
}

export interface TrendPoint {
  sample_date: string;
  depression_prob: number;
  anxiety_prob: number;
  risk_tier: string;
  depression_ci_low?: number;
  depression_ci_high?: number;
  anxiety_ci_low?: number;
  anxiety_ci_high?: number;
  prediction_id: string;
}

export interface PatientTrend {
  patient_id: string;
  patient_code: string;
  trend: TrendPoint[];
  total_analyses: number;
  deteriorating: boolean;
}

export interface CohortBenchmark {
  taxon_name: string;
  risk_tier: string;
  sample_count: number;
  mean_value: number;
  std_value: number;
  p25_value: number;
  p50_value: number;
  p75_value: number;
}

export const TAXA_CLINICAL_INFO: Record<string, { role: string; tooltip: string }> = {
  lachnospira: { role: "Protective", tooltip: "Butyrate producer. Low value = risk signal." },
  ruthenibacterium: { role: "Emerging", tooltip: "Secondary importance in XGB chain." },
  veillonella: { role: "Pathological", tooltip: "Elevated in Comorbid. Inflammation-associated." },
  gardnerella: { role: "Pathological", tooltip: "Primary driver. Elevated in Comorbid." },
  pseudobutyrivibrio: { role: "Protective", tooltip: "Gut barrier function. Depleted in disease." },
  kocuria: { role: "Context-dep.", tooltip: "Moderate importance across conditions." },
  trueperella: { role: "Differentiation", tooltip: "Distinguishes Depression vs Comorbid." },
  lancefieldella: { role: "Secondary", tooltip: "Lower importance — contextual signal." },
  fructilactobacillus: { role: "Comorbidity", tooltip: "Spikes only in Comorbid." },
  lachnoanaerobaculum: { role: "Secondary", tooltip: "Oral-gut axis microbe." },
  corynebacterium: { role: "Pathological", tooltip: "Core driver — Depression and Comorbid." },
  raoultella: { role: "Secondary", tooltip: "Oxidative stress association." },
  lawsonella: { role: "Pathological", tooltip: "Co-elevates with Gardnerella." },
};

// CSV Upload types
export interface CsvPredictionRow {
  row: number;
  prediction_id: string;
  sample_id: string;
  depression_prob: number;
  anxiety_prob: number;
  depression_label: number;
  anxiety_label: number;
  risk_tier: RiskTier;
  processing_time_ms: number;
  model_version: string;
  depression_ci_low?: number;
  depression_ci_high?: number;
  anxiety_ci_low?: number;
  anxiety_ci_high?: number;
}

export interface CsvUploadResult {
  total_rows: number;
  successful: number;
  failed: number;
  predictions: CsvPredictionRow[];
  errors: { row: number; error: string }[];
}
