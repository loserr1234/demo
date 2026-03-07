import apiClient from './apiClient';

export const paymentService = {
  createOrder: (ledgerId: string) =>
    apiClient.post('/payments/create-order', { ledgerId }),

  recordManual: (data: Record<string, unknown>) =>
    apiClient.post('/payments/manual', data),

  getById: (id: string) => apiClient.get(`/payments/${id}`),

  getAll: (params?: Record<string, unknown>) =>
    apiClient.get('/payments', { params }),

  getReceipt: (paymentId: string) =>
    apiClient.get(`/parent/receipt/${paymentId}`),
};
