import apiClient from './apiClient';

export const ledgerService = {
  getAll: (params?: Record<string, unknown>) =>
    apiClient.get('/ledger', { params }),

  getById: (id: string) => apiClient.get(`/ledger/${id}`),

  getByStudent: (studentId: string) =>
    apiClient.get(`/ledger/student/${studentId}`),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/ledger/${id}`, data),

  // Parent
  getForParentStudent: (studentId: string) =>
    apiClient.get(`/parent/student/${studentId}/ledger`),
};
