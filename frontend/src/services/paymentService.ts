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

  openReceipt: async (paymentId: string) => {
    const res = await apiClient.get(`/payments/${paymentId}/receipt`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  downloadReceipt: async (paymentId: string, filename: string) => {
    const res = await apiClient.get(`/payments/${paymentId}/receipt`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
