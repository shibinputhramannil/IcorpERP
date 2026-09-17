import api from './api';

export const salesService = {
  // ============================================================
  // 1. SALES DASHBOARD
  // ============================================================
  getDashboard: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/sales/dashboard/`);
    return response.data;
  },

  // ============================================================
  // 2. SALES QUOTATIONS
  // ============================================================
  getQuotations: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/quotations/`, { params });
    return response.data;
  },

  getQuotation: async (companyId, quoteId) => {
    const response = await api.get(`/companies/${companyId}/sales/quotations/${quoteId}/`);
    return response.data;
  },

  createQuotation: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/sales/quotations/`, data);
    return response.data;
  },

  updateQuotation: async (companyId, quoteId, data) => {
    const response = await api.patch(`/companies/${companyId}/sales/quotations/${quoteId}/`, data);
    return response.data;
  },

  deleteQuotation: async (companyId, quoteId) => {
    const response = await api.delete(`/companies/${companyId}/sales/quotations/${quoteId}/`);
    return response.data;
  },

  convertQuotation: async (companyId, quoteId) => {
    const response = await api.post(`/companies/${companyId}/sales/quotations/${quoteId}/convert/`);
    return response.data;
  },

  // ============================================================
  // 3. SALES ORDERS
  // ============================================================
  getOrders: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/orders/`, { params });
    return response.data;
  },

  getOrder: async (companyId, orderId) => {
    const response = await api.get(`/companies/${companyId}/sales/orders/${orderId}/`);
    return response.data;
  },

  createOrder: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/`, data);
    return response.data;
  },

  updateOrder: async (companyId, orderId, data) => {
    const response = await api.patch(`/companies/${companyId}/sales/orders/${orderId}/`, data);
    return response.data;
  },

  deleteOrder: async (companyId, orderId) => {
    const response = await api.delete(`/companies/${companyId}/sales/orders/${orderId}/`);
    return response.data;
  },

  // ============================================================
  // 4. INVENTORY RESERVATION & FULFILLMENT
  // ============================================================
  reserveOrder: async (companyId, orderId, data = {}) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/${orderId}/reserve/`, data);
    return response.data;
  },

  releaseReservation: async (companyId, orderId) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/${orderId}/release-reservation/`);
    return response.data;
  },

  fulfillOrder: async (companyId, orderId) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/${orderId}/fulfill/`);
    return response.data;
  },

  getReservations: async (companyId, orderId) => {
    const response = await api.get(`/companies/${companyId}/sales/orders/${orderId}/reservations/`);
    return response.data;
  },

  // ============================================================
  // 5. SALES INVOICES
  // ============================================================
  getInvoices: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/invoices/`, { params });
    return response.data;
  },

  getInvoice: async (companyId, invoiceId) => {
    const response = await api.get(`/companies/${companyId}/sales/invoices/${invoiceId}/`);
    return response.data;
  },

  createInvoice: async (companyId, data) => {
    const response = await api.post(`/companies/${companyId}/sales/invoices/`, data);
    return response.data;
  },

  createInvoiceFromOrder: async (companyId, orderId, data = {}) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/${orderId}/invoice/`, data);
    return response.data;
  },

  updateInvoice: async (companyId, invoiceId, data) => {
    const response = await api.patch(`/companies/${companyId}/sales/invoices/${invoiceId}/`, data);
    return response.data;
  },

  // ============================================================
  // 6. SALES PAYMENTS & RECEIPTS
  // ============================================================
  getInvoicePayments: async (companyId, invoiceId) => {
    const response = await api.get(`/companies/${companyId}/sales/invoices/${invoiceId}/payments/`);
    return response.data;
  },

  createPayment: async (companyId, invoiceId, data) => {
    const response = await api.post(`/companies/${companyId}/sales/invoices/${invoiceId}/payments/`, data);
    return response.data;
  },

  getInvoiceReceipts: async (companyId, invoiceId) => {
    const response = await api.get(`/companies/${companyId}/sales/invoices/${invoiceId}/receipts/`);
    return response.data;
  },

  getReceipts: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/receipts/`, { params });
    return response.data;
  },

  // ============================================================
  // 7. SALES FINANCIAL SUMMARY & ANALYTICS (Phase 4D)
  // ============================================================
  getFinancialSummary: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/sales/financial-summary/`);
    return response.data;
  },

  getAnalytics: async (companyId) => {
    const response = await api.get(`/companies/${companyId}/sales/analytics/`);
    return response.data;
  },

  getReports: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/reports/`, { params });
    return response.data;
  },

  getCustomerSalesHistory: async (companyId, customerId) => {
    const response = await api.get(`/companies/${companyId}/sales/customers/${customerId}/history/`);
    return response.data;
  },

  getPayments: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/payments/`, { params });
    return response.data;
  },

  // ============================================================
  // 8. SALES RETURNS (Phase 4D)
  // ============================================================
  createOrderReturn: async (companyId, orderId, data = {}) => {
    const response = await api.post(`/companies/${companyId}/sales/orders/${orderId}/return/`, data);
    return response.data;
  },

  getOrderReturns: async (companyId, orderId) => {
    const response = await api.get(`/companies/${companyId}/sales/orders/${orderId}/returns/`);
    return response.data;
  },

  getReturns: async (companyId, params = {}) => {
    const response = await api.get(`/companies/${companyId}/sales/returns/`, { params });
    return response.data;
  },
};


export default salesService;
