const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('fdr_sentinel_token');
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(`Network error connecting to backend API (${url}): ${netErr.message}`, 0);
  }

  if (response.status === 401) {
    // Unauthorized - token expired or invalid
    if (window.location.pathname !== '/login') {
      localStorage.removeItem('fdr_sentinel_token');
      localStorage.removeItem('fdr_sentinel_user');
      window.dispatchEvent(new Event('auth_logout'));
    }
  }

  // Handle CSV attachment downloads
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    const text = await response.text();
    return text as unknown as T;
  }

  // Detect HTML fallback (e.g. Vercel returning index.html for 404s)
  if (contentType.includes('text/html')) {
    throw new ApiError(`Backend API not found at ${url} (HTTP ${response.status}). If deployed on Vercel, ensure the backend API is deployed or configure VITE_API_URL.`, response.status);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.message || data.error || `HTTP ${response.status}: API request failed`, response.status, data);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request<any>('/auth/me'),
  getDemoUsers: () => request<any[]>('/auth/demo-users'),

  // Clock
  getClock: () => request<any>('/clock'),
  advanceClock: (days: number) =>
    request<any>('/clock/advance', { method: 'POST', body: JSON.stringify({ days }) }),
  setClockDate: (date: string) =>
    request<any>('/clock/set', { method: 'POST', body: JSON.stringify({ date }) }),
  resetClock: () => request<any>('/clock/reset', { method: 'POST' }),
  triggerScheduler: () => request<any>('/clock/trigger-scheduler', { method: 'POST' }),

  // FDRs
  getFdrs: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') searchParams.append(k, String(v));
    });
    return request<any>(`/fdrs?${searchParams.toString()}`);
  },
  getFdrById: (id: string) => request<any>(`/fdrs/${id}`),
  createFdr: (data: any) =>
    request<any>('/fdrs', { method: 'POST', body: JSON.stringify(data) }),
  updateFdrStatus: (id: string, status: string, note?: string) =>
    request<any>(`/fdrs/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
  extractPreview: (formData: FormData) =>
    request<any>('/fdrs/extract-preview', { method: 'POST', body: formData }),
  uploadDocument: (fdrId: string, formData: FormData) =>
    request<any>(`/fdrs/${fdrId}/documents`, { method: 'POST', body: formData }),
  addObservation: (fdrId: string, note: string, severity: string) =>
    request<any>(`/fdrs/${fdrId}/observations`, { method: 'POST', body: JSON.stringify({ note, severity }) }),
  resolveObservation: (fdrId: string, obsId: string) =>
    request<any>(`/fdrs/${fdrId}/observations/${obsId}/resolve`, { method: 'PATCH' }),

  // Verification
  getVerificationAdapters: () => request<any[]>('/verification/adapters'),
  verifyFdr: (fdrId: string, adapterId: string, additionalEvidence?: any, notes?: string) =>
    request<any>('/verification/verify', {
      method: 'POST',
      body: JSON.stringify({ fdr_id: fdrId, adapter_id: adapterId, additionalEvidence, notes }),
    }),

  // Release
  getReleaseRequests: (status?: string) =>
    request<any[]>(`/release${status ? `?status=${status}` : ''}`),
  getReleaseEligibility: (fdrId: string) => request<any>(`/release/eligibility/${fdrId}`),
  getReleaseRequestById: (id: string) => request<any>(`/release/${id}`),
  submitReleaseRequest: (data: { fdr_id: string; request_type: string; reason: string }) =>
    request<any>('/release', { method: 'POST', body: JSON.stringify(data) }),
  recommendReleaseRequest: (id: string, notes: string) =>
    request<any>(`/release/${id}/recommend`, { method: 'POST', body: JSON.stringify({ notes }) }),
  decideReleaseRequest: (id: string, decision: 'APPROVED' | 'REJECTED', decision_notes: string) =>
    request<any>(`/release/${id}/decide`, { method: 'POST', body: JSON.stringify({ decision, decision_notes }) }),

  // Rules
  getRules: () => request<any[]>('/rules'),
  updateRule: (ruleCode: string, data: { is_enabled?: boolean; severity?: string; parameters?: any }) =>
    request<any>(`/rules/${ruleCode}`, { method: 'PATCH', body: JSON.stringify(data) }),
  evaluateAllRules: () => request<any>('/rules/evaluate-all', { method: 'POST' }),

  // Dashboard
  getDashboard: (institutionId?: string) =>
    request<any>(`/dashboard${institutionId ? `?institution_id=${institutionId}` : ''}`),

  // Reports
  getPendingVerifications: (format?: string) =>
    request<any>(`/reports/pending-verifications${format ? `?format=${format}` : ''}`),
  getUpcomingMaturities: (format?: string) =>
    request<any>(`/reports/upcoming-maturities${format ? `?format=${format}` : ''}`),
  getMissingDocuments: (format?: string) =>
    request<any>(`/reports/missing-documents${format ? `?format=${format}` : ''}`),
  getInterventionCases: (format?: string) =>
    request<any>(`/reports/cases-needing-intervention${format ? `?format=${format}` : ''}`),

  // Audit
  getAuditEntries: (params: Record<string, any> = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.append(k, String(v));
    });
    return request<any>(`/audit?${searchParams.toString()}`);
  },
  verifyAuditIntegrity: () => request<any>('/audit/verify'),
  tamperAuditDemo: (sequence?: number) =>
    request<any>('/audit/tamper-demo', { method: 'POST', body: JSON.stringify({ sequence }) }),
  restoreAuditDemo: (sequence?: number) =>
    request<any>('/audit/restore-demo', { method: 'POST', body: JSON.stringify({ sequence }) }),

  // Benchmark & Scenarios
  getBenchmark: () => request<any>('/benchmark'),
  getScenarios: () => request<any>('/benchmark/scenarios'),
  resetSeedDataset: () => request<any>('/benchmark/seed', { method: 'POST' }),

  // Import
  bulkImport: (formData: FormData) =>
    request<any>('/import/bulk', { method: 'POST', body: formData }),
  getImportTemplate: () => request<string>('/import/sample-template'),

  // Notifications
  getNotifications: () => request<any>('/notifications'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<any>('/notifications/mark-all-read', { method: 'POST' }),

  // Escalations
  getEscalations: (status?: string) =>
    request<any[]>(`/escalations${status ? `?status=${status}` : ''}`),
  resolveEscalation: (id: string) => request<any>(`/escalations/${id}/resolve`, { method: 'PATCH' }),
};
