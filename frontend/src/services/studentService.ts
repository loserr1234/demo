import apiClient from './apiClient';

export const studentService = {
  // Admin endpoints
  getAll: (params?: Record<string, unknown>) =>
    apiClient.get('/admin/students', { params }),

  getById: (id: string) => apiClient.get(`/admin/student/${id}`),

  create: (data: Record<string, unknown>) => apiClient.post('/admin/student', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.put(`/admin/student/${id}`, data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch(`/admin/student/${id}/status`, { status }),

  getStats: () => apiClient.get('/admin/stats'),

  getAuditLogs: (params?: Record<string, unknown>) =>
    apiClient.get('/admin/audit-logs', { params }),

  // Parent endpoints
  getChildren: () => apiClient.get('/parent/children'),

  getChildForParent: (id: string) => apiClient.get(`/parent/student/${id}`),
};
