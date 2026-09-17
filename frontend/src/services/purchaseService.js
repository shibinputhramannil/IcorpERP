import api from './api';

export const purchaseService = {
  // ============================================================
  // 1. PURCHASE DASHBOARD
  // ============================================================
  getDashboard: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/purchases/dashboard/`);
    return response.data;
  },

  // ============================================================
  // 2. PURCHASE QUOTATIONS
  // ============================================================
  getQuotations: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/purchases/quotations/`, { params });
    return response.data;
  },

  getQuotation: async (companyId, quoteId) => {
    const response = await api.get(`/companies/${companyId}/purchases/quotations/${quoteId}/`);
    return response.data;
  },

  createQuotation: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/purchases/quotations/`, data);
    return response.data;
  },

  updateQuotation: async (companyId, quoteId, data) => {
    const response = await api.patch(`/companies/${companyId}/purchases/quotations/${quoteId}/`, data);
    return response.data;
  },

  deleteQuotation: async (companyId, quoteId) => {
    const response = await api.delete(`/companies/${companyId}/purchases/quotations/${quoteId}/`);
    return response.data;
  },

  convertToOrder: async (companyId, quoteId, data = {}) => {
    const response = await api.post(`/companies/${companyId}/purchases/quotations/${quoteId}/convert-to-order/`, data);
    return response.data;
  },

  // ============================================================
  // 3. PURCHASE ORDERS
  // ============================================================
  getOrders: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/purchases/orders/`, { params });
    return response.data;
  },

  getOrder: async (companyId, orderId) => {
    const response = await api.get(`/companies/${companyId}/purchases/orders/${orderId}/`);
    return response.data;
  },

  createOrder: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/purchases/orders/`, data);
    return response.data;
  },

  updateOrder: async (companyId, orderId, data) => {
    const response = await api.patch(`/companies/${companyId}/purchases/orders/${orderId}/`, data);
    return response.data;
  },

  deleteOrder: async (companyId, orderId) => {
    const response = await api.delete(`/companies/${companyId}/purchases/orders/${orderId}/`);
    return response.data;
  },

  // ============================================================
  // 4. GOODS RECEIVING & RECEIPTS (Phase 5B)
  // ============================================================
  receiveOrder: async (companyId, orderId, data) => {
    const response = await api.post(`/companies/${companyId}/purchases/orders/${orderId}/receive/`, data);
    return response.data;
  },

  getOrderReceipts: async (companyId, orderId) => {
    const response = await api.get(`/companies/${companyId}/purchases/orders/${orderId}/receipts/`);
    return response.data;
  },

  getReceipts: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/purchases/receipts/`, { params });
    return response.data;
  },

  getReceipt: async (companyId, receiptId) => {
    const response = await api.get(`/companies/${companyId}/purchases/receipts/${receiptId}/`);
    return response.data;
  },

  // ============================================================
  // 5. VENDOR PURCHASE HISTORY
  // ============================================================
  getVendorHistory: async (companyId, vendorId) => {
    const response = await api.get(`/companies/${companyId}/purchases/vendors/${vendorId}/history/`);
    return response.data;
  },
};

export default purchaseService;
