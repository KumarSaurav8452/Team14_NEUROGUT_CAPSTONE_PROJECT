/* NEUROGUT v4.0 -- API Client */
import type {
  TokenResponse, User, Patient, PatientDetail,
  PredictionInput, PredictionResult, ModelHealth, Report, Sample,
  Alert, AlertCount, AuditEntry, PatientTrend, CohortBenchmark,
  CsvUploadResult,
} from "./types";
import type { Disease, V2Model, V2Prediction, V2CsvResult } from "./typesV2";

// Unset (local dev) -> backend on :8000. Set to "" (Docker/nginx) -> same origin, so it works on any host.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("neurogut_token");
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("neurogut_token", token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("neurogut_token");
      localStorage.removeItem("neurogut_user");
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      this.clearToken();
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "API Error");
    }
    return res.json();
  }

  // Auth
  login(email: string, password: string) {
    return this.request<TokenResponse>("POST", "/api/auth/login", { email, password });
  }

  getMe() {
    return this.request<User>("GET", "/api/auth/me");
  }

  // Predictions
  predict(input: PredictionInput, sampleId?: string) {
    const qs = sampleId ? `?sample_id=${encodeURIComponent(sampleId)}` : "";
    return this.request<PredictionResult>("POST", `/api/predict${qs}`, input);
  }

  getModelHealth() {
    return this.request<ModelHealth>("GET", "/api/model/health");
  }

  getPrediction(id: string) {
    return this.request<PredictionResult>("GET", `/api/predictions/${id}`);
  }

  // Patients
  createPatient(data: { patient_code: string; age?: number; sex?: string; notes?: string }) {
    return this.request<Patient>("POST", "/api/patients", data);
  }

  listPatients(page = 1, pageSize = 20, search = "") {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) params.set("search", search);
    return this.request<{ patients: Patient[]; total: number; page: number; page_size: number }>(
      "GET", `/api/patients?${params}`
    );
  }

  getPatient(id: string) {
    return this.request<PatientDetail>("GET", `/api/patients/${id}`);
  }

  submitSample(data: Record<string, unknown>) {
    return this.request<Sample>("POST", "/api/samples", data);
  }

  // Reports
  generateReport(predictionId: string) {
    return this.request<Report>("POST", "/api/reports/generate", { prediction_id: predictionId });
  }

  getReportDownloadUrl(reportId: string): string {
    const t = this.token ? `?token=${encodeURIComponent(this.token)}` : "";
    return `${API_BASE}/api/reports/${reportId}/download${t}`;
  }

  listReports() {
    return this.request<Report[]>("GET", "/api/reports/");
  }

  // Admin
  listUsers(params?: { search?: string; role?: string; status?: string; page?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.role) qs.set("role", params.role);
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    const query = qs.toString() ? `?${qs}` : "";
    return this.request<User[]>("GET", `/api/admin/users${query}`);
  }

  createUser(data: { email: string; role: string; full_name: string; welcome_message?: string }) {
    return this.request<User>("POST", "/api/admin/users", data);
  }

  // Legacy invite alias
  inviteUser(email: string, role: string, fullName: string) {
    return this.request<User>("POST", "/api/admin/users/invite", { email, role, full_name: fullName });
  }

  updateUserRole(userId: string, role: string) {
    return this.request<User>("PATCH", `/api/admin/users/${userId}/role`, { role });
  }

  deactivateUser(userId: string) {
    return this.request<User>("PATCH", `/api/admin/users/${userId}/deactivate`);
  }

  activateUser(userId: string) {
    return this.request<User>("PATCH", `/api/admin/users/${userId}/activate`);
  }

  reinviteUser(userId: string) {
    return this.request<User>("POST", `/api/admin/users/${userId}/reinvite`);
  }

  toggleUser(userId: string) {
    return this.request<{ id: string; is_active: boolean }>("PATCH", `/api/admin/users/${userId}/toggle`);
  }

  acceptInvite(token: string, password: string) {
    return this.request<TokenResponse>("POST", "/api/auth/accept-invite", { token, password });
  }

  // ====== v2.0 APIs ======

  // Alerts
  getAlertCount() {
    return this.request<AlertCount>("GET", "/api/alerts/count");
  }

  listAlerts(status?: string, page = 1) {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    return this.request<Alert[]>("GET", `/api/alerts?${params}`);
  }

  resolveAlert(alertId: string, notes: string) {
    return this.request<{ id: string; status: string }>("PATCH", `/api/alerts/${alertId}/resolve`, { notes });
  }

  // Audit
  listAuditLogs(page = 1, action?: string) {
    const params = new URLSearchParams({ page: String(page) });
    if (action) params.set("action", action);
    return this.request<AuditEntry[]>("GET", `/api/audit?${params}`);
  }

  // Longitudinal Trend
  getPatientTrend(patientId: string) {
    return this.request<PatientTrend>("GET", `/api/patients/${patientId}/trend`);
  }

  // Cohort Benchmarks
  getBenchmarks() {
    return this.request<CohortBenchmark[]>("GET", "/api/benchmarks");
  }

  // CSV Upload
  async predictCsv(file: File): Promise<CsvUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/predict/csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: formData,
    });
    if (res.status === 401) { this.clearToken(); throw new Error("Unauthorized"); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "CSV upload failed");
    }
    return res.json();
  }

  getCsvTemplateUrl(): string {
    return `${API_BASE}/api/templates/csv`;
  }

  // Data Export
  async exportDataset(format: "csv" | "json" = "csv", tier?: string): Promise<void> {
    const params = new URLSearchParams({ format });
    if (tier) params.set("tier", tier);
    const res = await fetch(`${API_BASE}/api/export?${params}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (res.status === 401) { this.clearToken(); throw new Error("Unauthorized"); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Export failed");
    }
    // Extract filename from Content-Disposition header
    const disposition = res.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `neurogut_export.${format}`;

    // Download via blob
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // NeuroGut v2: Parkinson's / schizophrenia predictions
  getV2Models() {
    return this.request<V2Model[]>("GET", "/api/v2/models");
  }

  predictV2(input: { disease: Disease; patient_id?: string; sample_label?: string; collection_date?: string;
    abundances: Record<string, number> }) {
    return this.request<V2Prediction>("POST", "/api/v2/predict", input);
  }

  async predictV2Csv(disease: Disease, file: File, patientId?: string): Promise<V2CsvResult> {
    const form = new FormData();
    form.append("disease", disease);
    form.append("file", file);
    if (patientId) form.append("patient_id", patientId);
    const res = await fetch(`${API_BASE}/api/v2/predict/csv`, {
      method: "POST", headers: { Authorization: `Bearer ${this.token}` }, body: form,
    });
    if (res.status === 401) { this.clearToken(); throw new Error("Unauthorized"); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  }

  listV2Predictions(disease?: Disease, patientId?: string) {
    const params = new URLSearchParams();
    if (disease) params.set("disease", disease);
    if (patientId) params.set("patient_id", patientId);
    return this.request<V2Prediction[]>("GET", `/api/v2/predictions?${params}`);
  }

  async downloadV2Template(disease: Disease): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v2/templates/${disease}`, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error("Template download failed");
    const url = window.URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurogut_v2_${disease}_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();
